import { randomUUID } from "node:crypto";
import { Op, col, fn } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { Course, Evaluation, SessionTrainerAssignment, TrainerBooking, TrainerCertification, TrainerProfile, Training, TrainingSession, TrainingTrainerAssignment } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "../accounts/keycloak-account-provisioner";
import Joi from "joi";

export const trainersRouter = Router();
const ACTIVATION_LIFESPAN_SECONDS = 24 * 60 * 60;
const pageNumber = (value: unknown, fallback: number, max: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
};
const nameParts = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};
const isDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
type CertificationInput = { name: string; expiresAt: string };

function validateInput(body: Record<string, unknown>, isEdit = false) {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(200).required(),
    trainerCode: isEdit ? Joi.any().optional() : Joi.string().trim().min(1).max(50).required(),
    email: isEdit ? Joi.any().optional() : Joi.string().trim().email().max(254).required(),
    specialization: Joi.string().trim().min(1).max(255).required(),
    status: isEdit ? Joi.string().valid("PENDING", "ACTIVE", "INACTIVE").required() : Joi.any().optional(),
    certifications: Joi.array().max(30).items(Joi.object({
      name: Joi.string().trim().min(1).max(200).required(),
      expiresAt: Joi.string().custom((value, helpers) => isDate(value) ? value : helpers.error("date.format")).required(),
    }).unknown(false)).required(),
  }).unknown(false);
  return !schema.validate(body, { abortEarly: false, allowUnknown: false, convert: false }).error;
}

async function loadCertifications(trainerIds: string[]) {
  if (!trainerIds.length) return new Map<string, Record<string, unknown>[]>();
  const rows = await TrainerCertification.findAll({ where: { trainer_profile_id: { [Op.in]: trainerIds } }, order: [["expires_at", "ASC"], ["name", "ASC"]], raw: true }) as unknown as Array<Record<string, unknown> & { trainer_profile_id: string; expires_at: string }>;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const byTrainer = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const id = String(row.trainer_profile_id);
    const [year, month, day] = row.expires_at.slice(0, 10).split("-").map(Number);
    const daysUntilExpiry = Math.floor((Date.UTC(year, month - 1, day) - todayUtc) / 86_400_000);
    byTrainer.set(id, [
      ...(byTrainer.get(id) ?? []),
      {
        id: row.id,
        name: row.name,
        expires_at: row.expires_at,
        days_until_expiry: daysUntilExpiry,
      },
    ]);
  }
  return byTrainer;
}

async function loadTrainerRatings(trainerIds: string[]) {
  if (!trainerIds.length) return new Map<string, number>();
  const assignments = await loadTrainerAssignments(trainerIds);
  const distinctTrainingIds = [...new Set(assignments.flatMap((row) => row.training_id))];
  const evaluations = distinctTrainingIds.length ? await Evaluation.findAll({
    attributes: ["training_id", "score"],
    where: { training_id: { [Op.in]: distinctTrainingIds }, score: { [Op.ne]: null } },
    raw: true,
  }) as unknown as Array<{ training_id: string; score: number }> : [];
  const scoresByTraining = new Map<string, number[]>();
  for (const evaluation of evaluations) scoresByTraining.set(evaluation.training_id, [...(scoresByTraining.get(evaluation.training_id) ?? []), Number(evaluation.score)]);
  const pairKeys = new Set(assignments.map((row) => `${row.trainer_profile_id}:${row.training_id}`));
  const sums = new Map<string, { sum: number; count: number }>();
  for (const pair of pairKeys) {
    const [trainerId, trainingId] = pair.split(":");
    for (const score of scoresByTraining.get(trainingId) ?? []) {
      const current = sums.get(trainerId) ?? { sum: 0, count: 0 };
      current.sum += score;
      current.count += 1;
      sums.set(trainerId, current);
    }
  }
  return new Map(trainerIds.map((id) => [id, (sums.get(id)?.sum ?? 0) / (sums.get(id)?.count || 1)]));
}

type TrainerAssignmentRow = { trainer_profile_id: string; training_id: string; assigned_at: Date };
async function loadTrainerAssignments(trainerIds: string[]): Promise<TrainerAssignmentRow[]> {
  if (!trainerIds.length) return [];
  const [direct, session] = await Promise.all([
    TrainingTrainerAssignment.findAll({ attributes: ["trainer_profile_id", "training_id", "assigned_at"], where: { trainer_profile_id: { [Op.in]: trainerIds } }, raw: true }),
    SessionTrainerAssignment.findAll({
      attributes: ["trainer_profile_id", "assigned_at"],
      where: { trainer_profile_id: { [Op.in]: trainerIds } },
      include: [{ model: TrainingSession, as: "session", attributes: ["training_id"], required: true }],
    }),
  ]);
  const sessionRows = session.map((assignment) => ({
    trainer_profile_id: assignment.trainer_profile_id,
    training_id: (assignment.get("session") as TrainingSession).training_id,
    assigned_at: assignment.assigned_at,
  }));
  return [...direct as unknown as TrainerAssignmentRow[], ...sessionRows];
}

async function scheduledTrainerIds(dates: string[], transaction?: import("sequelize").Transaction) {
  if (!dates.length) return new Set<string>();
  const sorted = [...dates].sort();
  const start = new Date(`${sorted[0]}T00:00:00.000Z`);
  const end = new Date(`${sorted[sorted.length - 1]}T23:59:59.999Z`);
  const candidates = await TrainingSession.findAll({
    where: { starts_at: { [Op.gte]: start, [Op.lte]: end } },
    include: [{ model: Training, as: "training", where: { status: { [Op.in]: ["SCHEDULED", "ONGOING"] } }, attributes: ["id"], required: true }],
    ...(transaction ? { transaction } : {}),
  });
  const wanted = new Set(dates);
  const sessions = candidates.filter((session) => wanted.has(new Date(session.starts_at).toISOString().slice(0, 10)));
  if (!sessions.length) return new Set<string>();
  const trainingIds = [...new Set(sessions.map((session) => session.training_id))];
  const sessionIds = sessions.map((session) => session.id);
  const [trainingAssignments, sessionAssignments] = await Promise.all([
    TrainingTrainerAssignment.findAll({ where: { training_id: { [Op.in]: trainingIds }, ended_at: null }, attributes: ["trainer_profile_id"], ...(transaction ? { transaction } : {}) }),
    SessionTrainerAssignment.findAll({ where: { session_id: { [Op.in]: sessionIds }, ended_at: null }, attributes: ["trainer_profile_id"], ...(transaction ? { transaction } : {}) }),
  ]);
  return new Set([...trainingAssignments, ...sessionAssignments].map((assignment) => assignment.trainer_profile_id));
}

const activateRequiredActionsEmail = (subject: string) =>
  keycloakAccountProvisioner.sendRequiredActionsEmail(
    subject,
    ["UPDATE_PASSWORD"],
    ACTIVATION_LIFESPAN_SECONDS,
    env.keycloakTrainerActivationClientId,
    env.keycloakTrainerActivationRedirectUri
  );

trainersRouter.get(
  "/specializations",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (_req, res) => {
    const rows = await TrainerProfile.findAll({
      attributes: ["specialization"],
      where: { specialization: { [Op.ne]: "" } },
      group: ["specialization"],
      order: [["specialization", "ASC"]],
      raw: true,
    }) as unknown as Array<{ specialization: string }>;
    return res.json({ items: rows.map((row) => row.specialization) });
  })
);

trainersRouter.get(
  "/booking-options",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const date = req.query.date;
    if (typeof date !== "string" || !isDate(date)) return res.status(400).json({ message: "Choose a valid booking date." });
    const [busyInTraining, busyInBooking] = await Promise.all([
      scheduledTrainerIds([date]),
      TrainerBooking.findAll({ where: { booking_date: date, status: "BOOKED" }, attributes: ["trainer_profile_id"] }),
    ]);
    const unavailable = new Set([...busyInTraining, ...busyInBooking.map((booking) => booking.trainer_profile_id)]);
    const profiles = await TrainerProfile.findAll({ where: { status: "ACTIVE", id: { [Op.notIn]: [...unavailable] } }, attributes: ["id", "name", "specialization", "email", "status", "rating"], order: [["name", "ASC"]], raw: true });
    return res.json({ items: profiles.map((trainer) => ({ ...trainer, name: trainer.name ?? trainer.email, availability: "AVAILABLE" })) });
  })
);

trainersRouter.post(
  "/bookings",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const schema = Joi.object({
      trainerId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
      date: Joi.string().custom((value, helpers) => isDate(value) ? value : helpers.error("date.format")).required(),
      reason: Joi.string().valid("MEETING", "EVENTS", "WORKSHOP", "OTHERS").required(),
      reasonDetail: Joi.when("reason", { is: "OTHERS", then: Joi.string().trim().min(1).max(2000).required(), otherwise: Joi.any().forbidden() }),
      detailBooking: Joi.string().trim().min(1).max(4000).required(),
    }).unknown(false);
    const { error: validationError, value } = schema.validate(req.body, { abortEarly: false, convert: false });
    if (validationError) return res.status(400).json({ message: "Choose a Trainer, date, Reason, and booking detail. Specify the Reason when you choose Others." });
    const bookingId = randomUUID();
    await sequelize.transaction(async (transaction) => {
      const trainer = await TrainerProfile.findByPk(value.trainerId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!trainer || trainer.status !== "ACTIVE") throw new AppError(409, "Choose an active Trainer.");
      const [busyInTraining, existingBooking] = await Promise.all([
        scheduledTrainerIds([value.date], transaction),
        TrainerBooking.findOne({ where: { trainer_profile_id: value.trainerId, booking_date: value.date, status: "BOOKED" }, transaction, lock: transaction.LOCK.UPDATE }),
      ]);
      if (busyInTraining.has(value.trainerId) || existingBooking) throw new AppError(409, "This Trainer is already booked or assigned to a Training on that date.");
      const reasonDetail = value.reason === "OTHERS" ? value.reasonDetail.trim() : null;
      await TrainerBooking.create({ id: bookingId, trainer_profile_id: value.trainerId, booking_date: value.date, reason: value.reason, reason_detail: reasonDetail, detail_booking: value.detailBooking.trim(), status: "BOOKED", created_by_subject: req.auth!.userId, replaced_by_training_id: null }, { transaction });
      await appendRequestAuditTrail(req, { action: "CREATE", objectType: "TRAINER_BOOKING", objectId: bookingId, after: { trainer_profile_id: value.trainerId, booking_date: value.date, reason: value.reason, reason_detail: reasonDetail, detail_booking: value.detailBooking.trim(), status: "BOOKED" }, processName: "trainer-booking-create" }, transaction);
    });
    return res.status(201).json({ item: { id: bookingId, trainerId: value.trainerId, date: value.date, status: "BOOKED" } });
  })
);

trainersRouter.get(
  "/",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const page = pageNumber(req.query.page, 1, 1_000_000);
    const pageSize = pageNumber(req.query.pageSize, 8, 100);
    if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
    const search = req.query.search;
    const specialization = req.query.specialization;
    const status = req.query.status ?? "ALL";
    if (search !== undefined && (typeof search !== "string" || search.length > 150))
      return res.status(400).json({ message: "Invalid search" });
    if (
      specialization !== undefined &&
      (typeof specialization !== "string" || specialization.length > 255)
    )
      return res.status(400).json({ message: "Invalid specialization filter" });
    if (!["ALL", "PENDING", "ACTIVE", "INACTIVE"].includes(String(status)))
      return res.status(400).json({ message: "Invalid status filter" });
    const pattern = search ? `%${String(search).replace(/[\\%_]/g, "\\$&")}%` : undefined;
    const where = {
      ...(pattern ? { [Op.or]: [
        { trainer_code: { [Op.iLike]: pattern } },
        { name: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        { specialization: { [Op.iLike]: pattern } },
      ] } : {}),
      ...(specialization ? { specialization } : {}),
      ...(status !== "ALL" ? { status: String(status) } : {}),
    };
    const { count: total, rows: profiles } = await TrainerProfile.findAndCountAll({
      where,
      order: [["trainer_code", "ASC"], ["name", "ASC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const trainerIds = profiles.map((row) => row.id);
    const assignments = await loadTrainerAssignments(trainerIds);
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const stats = new Map<string, { yearly: Set<string>; monthly: Set<string>; history: Set<string> }>();
    for (const assignment of assignments) {
      const value = stats.get(assignment.trainer_profile_id) ?? { yearly: new Set<string>(), monthly: new Set<string>(), history: new Set<string>() };
      value.history.add(assignment.training_id);
      const assignedAt = new Date(assignment.assigned_at);
      if (assignedAt.getUTCFullYear() === currentYear) {
        value.yearly.add(assignment.training_id);
        if (assignedAt.getUTCMonth() === currentMonth) value.monthly.add(assignment.training_id);
      }
      stats.set(assignment.trainer_profile_id, value);
    }
    const [certificationMap, ratingMap] = await Promise.all([
      loadCertifications(trainerIds),
      loadTrainerRatings(trainerIds),
    ]);
    const keycloakTrainers = await keycloakAccountProvisioner.listRoleMembers(ROLES.TRAINER, true);
    const identities = new Map(keycloakTrainers.map((user) => [user.userId, user]));
    const items = profiles.map((profile) => {
      const row = profile.get({ plain: true }) as Record<string, unknown>;
      const identity = identities.get(String(row.keycloak_subject));
      const counts = stats.get(profile.id);
      return {
        ...row,
        name:
          row.name ??
          ([identity?.firstName, identity?.lastName].filter(Boolean).join(" ") ||
            identity?.username ||
            null),
        email: row.email ?? identity?.email ?? null,
        rating: ratingMap.get(String(row.id)) ?? 0,
        yearly_class_count: counts?.yearly.size ?? 0,
        monthly_class_count: counts?.monthly.size ?? 0,
        training_history_count: counts?.history.size ?? 0,
        certifications: certificationMap.get(String(row.id)) ?? [],
      };
    });
    return res.json({ items, page, pageSize, total });
  })
);

trainersRouter.post(
  "/portal-login",
  authorizeActiveRole(ROLES.TRAINER),
  asyncHandler(async (req, res) => {
    await TrainerProfile.update({
      first_login_at: fn("COALESCE", col("first_login_at"), fn("NOW")),
      status: "ACTIVE",
    }, { where: { keycloak_subject: req.auth!.userId, status: { [Op.ne]: "INACTIVE" } } });
    return res.status(204).end();
  })
);

trainersRouter.post(
  "/",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if (!validateInput(body))
      return res
        .status(400)
        .json({
          message:
            "Trainer code, name, valid email, specialization, and valid certifications are required.",
        });
    const trainerCode = String(body.trainerCode).trim();
    const name = String(body.name).trim();
    const email = String(body.email).trim().toLowerCase();
    const specialization = String(body.specialization).trim();
    const rating = 0;
    const certifications = body.certifications as CertificationInput[];
    const existingCode = await TrainerProfile.findOne({ attributes: ["id"], where: { trainer_code: trainerCode } });
    if (existingCode)
      return res.status(409).json({ message: "Trainer code is already in use." });
    if ((await keycloakAccountProvisioner.findUsersByEmail(email)).length)
      return res.status(409).json({ message: "An account with this email address already exists" });
    const { firstName, lastName } = nameParts(name);
    let subject: string | null = null;
    try {
      const identity = await keycloakAccountProvisioner.createAccount({
        username: email,
        email,
        firstName,
        lastName,
        role: ROLES.TRAINER,
      });
      subject = identity.userId;
      await keycloakAccountProvisioner.updateIdentity(subject, {
        username: email,
        email,
        firstName,
        lastName,
      });
      await keycloakAccountProvisioner.setRequiredActions(subject, ["UPDATE_PASSWORD"]);
      await activateRequiredActionsEmail(subject);
      const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
      const transaction = await sequelize.transaction();
      try {
        const profile = await TrainerProfile.create(
          {
            id: randomUUID(),
            keycloak_subject: subject,
            trainer_code: trainerCode,
            name,
            email,
            specialization,
            rating,
            certification_expired: null,
            status: "PENDING",
            first_login_at: null,
            activation_expires_at: expiresAt,
          },
          { transaction }
        );
        await TrainerCertification.bulkCreate(certifications.map((certification) => ({
          id: randomUUID(),
          trainer_profile_id: profile.id,
          name: certification.name.trim(),
          expires_at: certification.expiresAt,
        })), { transaction });
        await appendRequestAuditTrail(
          req,
          {
            action: "CREATE",
            objectType: "TRAINER_PROFILE",
            objectId: profile.id,
            after: {
              trainer_code: trainerCode,
              name,
              email,
              specialization,
              rating,
              status: "PENDING",
              certifications,
            },
            processName: "trainer-create",
          },
          transaction
        );
        await transaction.commit();
        return res
          .status(201)
          .json({
            item: {
              id: profile.id,
              trainer_code: trainerCode,
              name,
              email,
              specialization,
              rating,
              status: "PENDING",
              first_login_at: null,
              activation_expires_at: expiresAt,
              certifications,
            },
          });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      if (subject) {
        await keycloakAccountProvisioner
          .setBusinessRole(subject, ROLES.TRAINER, false)
          .catch(() => undefined);
        await keycloakAccountProvisioner.deleteAccount(subject).catch(() => undefined);
      }
      if ((error as { name?: string }).name === "SequelizeUniqueConstraintError")
        return res.status(409).json({ message: "Trainer code or email is already in use." });
      throw error;
    }
  })
);

trainersRouter.get(
  "/:id",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
    const profile = await TrainerProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Trainer not found." });
    const [trainingRows, certificationMap, ratingMap] = await Promise.all([
      (async () => {
        const [direct, session] = await Promise.all([
          TrainingTrainerAssignment.findAll({ attributes: ["training_id", "assigned_at"], where: { trainer_profile_id: profile.id, ended_at: null } }),
          SessionTrainerAssignment.findAll({
            attributes: ["assigned_at"],
            where: { trainer_profile_id: profile.id, ended_at: null },
            include: [{ model: TrainingSession, as: "session", attributes: ["training_id"], required: true }],
          }),
        ]);
        const latestAssignedAt = new Map<string, Date>();
        for (const row of direct) {
          const previous = latestAssignedAt.get(row.training_id);
          if (!previous || row.assigned_at > previous) latestAssignedAt.set(row.training_id, row.assigned_at);
        }
        for (const row of session) {
          const trainingId = (row.get("session") as TrainingSession).training_id;
          const previous = latestAssignedAt.get(trainingId);
          if (!previous || row.assigned_at > previous) latestAssignedAt.set(trainingId, row.assigned_at);
        }
        if (!latestAssignedAt.size) return [];
        const trainings = await Training.findAll({
          attributes: ["id", "name", "status"],
          where: { id: { [Op.in]: [...latestAssignedAt.keys()] }, status: { [Op.in]: ["SCHEDULED", "ONGOING"] } },
          include: [{ model: Course, as: "course", attributes: ["name"], required: true }],
        });
        return trainings.map((training) => ({
          id: training.id,
          name: training.name,
          course_name: (training.get("course") as Course).name,
          status: training.status,
          assigned_at: latestAssignedAt.get(training.id),
        })).sort((left, right) => new Date(right.assigned_at!).getTime() - new Date(left.assigned_at!).getTime());
      })(),
      loadCertifications([profile.id]),
      loadTrainerRatings([profile.id]),
    ]);
    const [identity, assignmentHistory] = await Promise.all([
      keycloakAccountProvisioner.getIdentity(profile.keycloak_subject),
      loadTrainerAssignments([profile.id]),
    ]);
    const historyCount = new Set(assignmentHistory.map((row) => row.training_id)).size;
    return res.json({
      item: {
        id: profile.id,
        trainer_code: profile.trainer_code,
        name:
          profile.name ??
          ([identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.username),
        email: profile.email ?? identity.email ?? null,
        specialization: profile.specialization,
        rating: ratingMap.get(profile.id) ?? 0,
        status: profile.status,
        first_login_at: profile.first_login_at,
        activation_expires_at: profile.activation_expires_at,
        training_history_count: historyCount,
        certifications: certificationMap.get(profile.id) ?? [],
      },
      trainings: trainingRows,
    });
  })
);

trainersRouter.post(
  "/:id/resend-activation",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const profile = await TrainerProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Trainer not found." });
    if (profile.status !== "PENDING" || profile.first_login_at)
      return res
        .status(409)
        .json({
          message: "An activation email can only be resent to a Trainer who has not logged in.",
        });
    if (profile.activation_expires_at && profile.activation_expires_at.getTime() > Date.now())
      return res.status(409).json({ message: "The current activation link is still valid." });
    await keycloakAccountProvisioner.setRequiredActions(profile.keycloak_subject, [
      "UPDATE_PASSWORD",
    ]);
    await activateRequiredActionsEmail(profile.keycloak_subject);
    const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
    const before = { activation_expires_at: profile.activation_expires_at?.toISOString() ?? null };
    await profile.update({ activation_expires_at: expiresAt });
    await appendRequestAuditTrail(req, {
      action: "UPDATE",
      objectType: "TRAINER_PROFILE",
      objectId: profile.id,
      before,
      after: { activation_expires_at: expiresAt.toISOString() },
      processName: "trainer-activation-resend",
    });
    return res.status(202).json({ message: "Activation email sent", expiresAt });
  })
);

trainersRouter.put(
  "/:id",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if (!validateInput(body, true))
      return res
        .status(400)
        .json({
          message: "Trainer name, specialization, status, and valid certifications are required.",
        });
    const profile = await TrainerProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Trainer not found." });
    if (profile.status === "PENDING" && body.status !== "PENDING")
      return res
        .status(409)
        .json({ message: "Pending status is managed by the portal activation flow." });
    if (profile.status !== "PENDING" && body.status === "PENDING")
      return res
        .status(400)
        .json({ message: "Pending status is managed by the portal activation flow." });
    const name = String(body.name).trim();
    const specialization = String(body.specialization).trim();
    const nextStatus = String(body.status) as "PENDING" | "ACTIVE" | "INACTIVE";
    const certifications = body.certifications as CertificationInput[];
    const previousCertifications = await TrainerCertification.findAll({
      attributes: ["name", "expires_at"],
      where: { trainer_profile_id: profile.id },
      order: [["expires_at", "ASC"], ["name", "ASC"]],
      raw: true,
    }) as unknown as Array<{ name: string; expires_at: string | Date }>;
    const before = {
      name: profile.name,
      specialization: profile.specialization,
      status: profile.status,
      certifications: previousCertifications.map((item) => ({
        name: item.name,
        expiresAt: String(item.expires_at).slice(0, 10),
      })),
    };
    const nextCertifications = certifications.map((item) => ({
      name: item.name.trim(),
      expiresAt: item.expiresAt,
    }));
    const after = { name, specialization, status: nextStatus, certifications: nextCertifications };
    if (JSON.stringify(before) === JSON.stringify(after)) {
      const ratingMap = await loadTrainerRatings([profile.id]);
      return res.json({
        item: {
          id: profile.id,
          trainer_code: profile.trainer_code,
          name,
          email: profile.email,
          specialization,
          rating: ratingMap.get(profile.id) ?? 0,
          status: nextStatus,
          first_login_at: profile.first_login_at,
        },
      });
    }
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    const changes = { name, specialization, status: nextStatus };
    const changeStatus = profile.status !== nextStatus;
    if (changeStatus)
      await keycloakAccountProvisioner.setBusinessRole(
        profile.keycloak_subject,
        ROLES.TRAINER,
        nextStatus === "ACTIVE"
      );
    const { firstName, lastName } = nameParts(name);
    try {
      await keycloakAccountProvisioner.updateIdentity(profile.keycloak_subject, {
        username: identity.username,
        email: profile.email ?? identity.email ?? identity.username,
        firstName,
        lastName,
      });
      const transaction = await sequelize.transaction();
      try {
        await profile.update(changes, { transaction });
        await TrainerCertification.destroy({ where: { trainer_profile_id: profile.id }, transaction });
        await TrainerCertification.bulkCreate(certifications.map((certification) => ({
          id: randomUUID(),
          trainer_profile_id: profile.id,
          name: certification.name.trim(),
          expires_at: certification.expiresAt,
        })), { transaction });
        await appendRequestAuditTrail(
          req,
          {
            action: "UPDATE",
            objectType: "TRAINER_PROFILE",
            objectId: profile.id,
            before,
            after,
            processName: "trainer-update",
          },
          transaction
        );
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      if (changeStatus)
        await keycloakAccountProvisioner
          .setBusinessRole(profile.keycloak_subject, ROLES.TRAINER, profile.status === "ACTIVE")
          .catch(() => undefined);
      await keycloakAccountProvisioner
        .updateIdentity(profile.keycloak_subject, {
          username: identity.username,
          email: profile.email ?? identity.email ?? identity.username,
          firstName: identity.firstName ?? "",
          lastName: identity.lastName ?? "",
        })
        .catch(() => undefined);
      throw error;
    }
    const ratingMap = await loadTrainerRatings([profile.id]);
    return res.json({
      item: {
        id: profile.id,
        trainer_code: profile.trainer_code,
        name,
        email: profile.email,
        specialization,
        rating: ratingMap.get(profile.id) ?? 0,
        status: nextStatus,
        first_login_at: profile.first_login_at,
      },
    });
  })
);

trainersRouter.delete(
  "/:id",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("TRAINER", ACCESS_ACTIONS.DELETE),
  asyncHandler(async (req, res) => {
    const profile = await TrainerProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Trainer not found." });
    if (await TrainerBooking.count({ where: { trainer_profile_id: profile.id } }))
      return res.status(409).json({ message: "Trainer cannot be deleted because this Trainer has booking history. Deactivate the Trainer instead." });
    const assignments = await loadTrainerAssignments([profile.id]);
    const historyCount = new Set(assignments.map((row) => row.training_id)).size;
    if (historyCount > 0)
      return res
        .status(409)
        .json({
          message: `Trainer cannot be deleted because this Trainer has ${historyCount} training record${historyCount === 1 ? "" : "s"}. Deactivate the Trainer instead.`,
        });
    const roles = await keycloakAccountProvisioner.getBusinessRoles(profile.keycloak_subject);
    if (roles.some((role) => role !== ROLES.TRAINER))
      return res
        .status(409)
        .json({
          message:
            "The account has another business role and cannot be permanently deleted as a Trainer.",
        });

    // Keycloak deletion is idempotent (404 is accepted), so a failed DB transaction can be retried.
    await keycloakAccountProvisioner.deleteAccount(profile.keycloak_subject);
    const transaction = await sequelize.transaction();
    try {
      await appendRequestAuditTrail(
        req,
        {
          action: "DELETE",
          objectType: "TRAINER_PROFILE",
          objectId: profile.id,
          before: {
            trainer_code: profile.trainer_code,
            name: profile.name,
            email: profile.email,
            specialization: profile.specialization,
            status: profile.status,
            keycloak_subject: profile.keycloak_subject,
            keycloak_account_deleted: true,
          },
          processName: "trainer-delete",
        },
        transaction
      );
      await profile.destroy({ transaction });
      await transaction.commit();
      return res.status(204).end();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);
