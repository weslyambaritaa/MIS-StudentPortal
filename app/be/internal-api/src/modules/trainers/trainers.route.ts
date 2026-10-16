import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { TrainerProfile } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "../accounts/keycloak-account-provisioner";

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
const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
type CertificationInput = { name: string; expiresAt: string };

function validateInput(body: Record<string, unknown>, isEdit = false) {
  const name = body.name;
  const email = body.email;
  const code = body.trainerCode;
  const specialization = body.specialization;
  const status = body.status;
  const certifications = body.certifications;
  const valid = typeof name === "string" && !!name.trim() && name.trim().length <= 200
    && (isEdit || (typeof code === "string" && !!code.trim() && code.trim().length <= 50))
    && (isEdit || (typeof email === "string" && email.trim().length <= 254 && /^\S+@\S+\.\S+$/.test(email.trim())))
    && typeof specialization === "string" && !!specialization.trim() && specialization.trim().length <= 255
    && (!isEdit || ["PENDING", "ACTIVE", "INACTIVE"].includes(String(status)))
    && Array.isArray(certifications) && certifications.length <= 30
    && certifications.every((item) => item && typeof item === "object" && typeof (item as CertificationInput).name === "string" && !!(item as CertificationInput).name.trim() && (item as CertificationInput).name.trim().length <= 200 && isDate((item as CertificationInput).expiresAt));
  return valid;
}

async function loadCertifications(trainerIds: string[]) {
  if (!trainerIds.length) return new Map<string, Record<string, unknown>[]>();
  const rows = await sequelize.query<Record<string, unknown>>(
    "SELECT [id], [trainer_profile_id], [name], [expires_at], DATEDIFF(day, CONVERT(date, SYSUTCDATETIME()), CONVERT(date, [expires_at])) AS [days_until_expiry] FROM [dbo].[trainer_certification] WHERE [trainer_profile_id] IN (:ids) ORDER BY [expires_at], [name]",
    { replacements: { ids: trainerIds }, type: QueryTypes.SELECT },
  );
  const byTrainer = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const id = String(row.trainer_profile_id);
    const rawDaysUntilExpiry = row.days_until_expiry;
    const daysUntilExpiry = rawDaysUntilExpiry == null ? null : Number(rawDaysUntilExpiry);
    byTrainer.set(id, [...(byTrainer.get(id) ?? []), { id: row.id, name: row.name, expires_at: row.expires_at, days_until_expiry: daysUntilExpiry }]);
  }
  return byTrainer;
}

async function loadTrainerRatings(trainerIds: string[]) {
  if (!trainerIds.length) return new Map<string, number>();
  const rows = await sequelize.query<{ trainer_profile_id: string; rating: number | string }>(
    `SELECT assignments.[trainer_profile_id], COALESCE(AVG(CAST(ev.[score] AS DECIMAL(5,2))), 0) AS [rating]
       FROM (
         SELECT DISTINCT [training_id], [trainer_profile_id] FROM [dbo].[training_trainer_assignment]
         UNION
         SELECT DISTINCT ts.[training_id], sta.[trainer_profile_id] FROM [dbo].[session_trainer_assignment] sta
           JOIN [dbo].[training_session] ts ON ts.[id] = sta.[session_id]
       ) assignments
       LEFT JOIN [dbo].[evaluation] ev ON ev.[training_id] = assignments.[training_id] AND ev.[score] IS NOT NULL
      WHERE assignments.[trainer_profile_id] IN (:ids)
      GROUP BY assignments.[trainer_profile_id]`,
    { replacements: { ids: trainerIds }, type: QueryTypes.SELECT },
  );
  return new Map(rows.map((row) => [String(row.trainer_profile_id), Number(row.rating)]));
}

const activateRequiredActionsEmail = (subject: string) => keycloakAccountProvisioner.sendRequiredActionsEmail(subject, ["UPDATE_PASSWORD"], ACTIVATION_LIFESPAN_SECONDS, env.keycloakPicActivationClientId, env.keycloakPicActivationRedirectUri);

trainersRouter.get("/specializations", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW), asyncHandler(async (_req, res) => {
  const rows = await sequelize.query<{ specialization: string }>("SELECT DISTINCT [specialization] FROM [dbo].[trainer_profile] WHERE [specialization] IS NOT NULL AND [specialization] <> '' ORDER BY [specialization]", { type: QueryTypes.SELECT });
  return res.json({ items: rows.map((row) => row.specialization) });
}));

trainersRouter.get("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  res.set("Cache-Control", "no-store");
  const page = pageNumber(req.query.page, 1, 1_000_000);
  const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
  const search = req.query.search;
  const specialization = req.query.specialization;
  const status = req.query.status ?? "ALL";
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) return res.status(400).json({ message: "Invalid search" });
  if (specialization !== undefined && (typeof specialization !== "string" || specialization.length > 255)) return res.status(400).json({ message: "Invalid specialization filter" });
  if (!["ALL", "PENDING", "ACTIVE", "INACTIVE"].includes(String(status))) return res.status(400).json({ message: "Invalid status filter" });
  const clauses = ["1 = 1"];
  const replacements: Record<string, unknown> = { offset: (page - 1) * pageSize, pageSize };
  if (search) { clauses.push("(tp.[trainer_code] LIKE :search OR tp.[name] LIKE :search OR tp.[email] LIKE :search OR tp.[specialization] LIKE :search)"); replacements.search = `%${String(search).replace(/[\[%_]/g, (character) => `[${character}]`)}%`; }
  if (specialization) { clauses.push("tp.[specialization] = :specialization"); replacements.specialization = specialization; }
  if (status !== "ALL") { clauses.push("tp.[status] = :status"); replacements.status = status; }
  const where = `WHERE ${clauses.join(" AND ")}`;
  const totals = await sequelize.query<{ total: number | string }>(`SELECT COUNT_BIG(1) AS [total] FROM [dbo].[trainer_profile] tp ${where}`, { replacements, type: QueryTypes.SELECT });
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT tp.[id], tp.[keycloak_subject], tp.[trainer_code], tp.[name], tp.[email], tp.[specialization], tp.[rating], tp.[status], tp.[first_login_at], tp.[activation_expires_at],
      (SELECT COUNT_BIG(DISTINCT assigned.[training_id]) FROM (
        SELECT tta.[training_id], tta.[trainer_profile_id], tta.[assigned_at], tta.[ended_at] FROM [dbo].[training_trainer_assignment] tta
        UNION ALL SELECT ts.[training_id], sta.[trainer_profile_id], sta.[assigned_at], sta.[ended_at] FROM [dbo].[session_trainer_assignment] sta JOIN [dbo].[training_session] ts ON ts.[id] = sta.[session_id]
      ) assigned WHERE assigned.[trainer_profile_id] = tp.[id] AND YEAR(assigned.[assigned_at]) = YEAR(SYSUTCDATETIME())) AS [yearly_class_count],
      (SELECT COUNT_BIG(DISTINCT assigned.[training_id]) FROM (
        SELECT tta.[training_id], tta.[trainer_profile_id], tta.[assigned_at], tta.[ended_at] FROM [dbo].[training_trainer_assignment] tta
        UNION ALL SELECT ts.[training_id], sta.[trainer_profile_id], sta.[assigned_at], sta.[ended_at] FROM [dbo].[session_trainer_assignment] sta JOIN [dbo].[training_session] ts ON ts.[id] = sta.[session_id]
      ) assigned WHERE assigned.[trainer_profile_id] = tp.[id] AND YEAR(assigned.[assigned_at]) = YEAR(SYSUTCDATETIME()) AND MONTH(assigned.[assigned_at]) = MONTH(SYSUTCDATETIME())) AS [monthly_class_count]
     FROM [dbo].[trainer_profile] tp ${where} ORDER BY tp.[trainer_code], tp.[name] OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY`,
    { replacements, type: QueryTypes.SELECT },
  );
  const trainerIds = rows.map((row) => String(row.id));
  const [certificationMap, ratingMap] = await Promise.all([loadCertifications(trainerIds), loadTrainerRatings(trainerIds)]);
  const keycloakTrainers = await keycloakAccountProvisioner.listRoleMembers(ROLES.TRAINER, true);
  const identities = new Map(keycloakTrainers.map((user) => [user.userId, user]));
  const items = rows.map((row) => {
    const identity = identities.get(String(row.keycloak_subject));
    return { ...row, name: row.name ?? ([identity?.firstName, identity?.lastName].filter(Boolean).join(" ") || identity?.username || null), email: row.email ?? identity?.email ?? null, rating: ratingMap.get(String(row.id)) ?? 0, yearly_class_count: Number(row.yearly_class_count ?? 0), monthly_class_count: Number(row.monthly_class_count ?? 0), certifications: certificationMap.get(String(row.id)) ?? [] };
  });
  return res.json({ items, page, pageSize, total: Number(totals[0]?.total ?? 0) });
}));

trainersRouter.post("/portal-login", authorizeActiveRole(ROLES.TRAINER), asyncHandler(async (req, res) => {
  await sequelize.query("UPDATE [dbo].[trainer_profile] SET [first_login_at] = COALESCE([first_login_at], SYSUTCDATETIME()), [status] = 'ACTIVE', [updated_at] = SYSUTCDATETIME() WHERE [keycloak_subject] = :subject AND [status] <> 'INACTIVE'", { replacements: { subject: req.auth!.userId } });
  return res.status(204).end();
}));

trainersRouter.post("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  if (!validateInput(body)) return res.status(400).json({ message: "Trainer code, name, valid email, specialization, and valid certifications are required." });
  const trainerCode = String(body.trainerCode).trim();
  const name = String(body.name).trim();
  const email = String(body.email).trim().toLowerCase();
  const specialization = String(body.specialization).trim();
  const rating = 0;
  const certifications = body.certifications as CertificationInput[];
  const existingCode = await sequelize.query<{ trainer_code: string }>("SELECT TOP (1) [trainer_code] FROM [dbo].[trainer_profile] WHERE [trainer_code] = :code", { replacements: { code: trainerCode }, type: QueryTypes.SELECT });
  if (existingCode.length) return res.status(409).json({ message: "Trainer code is already in use." });
  if ((await keycloakAccountProvisioner.findUsersByEmail(email)).length) return res.status(409).json({ message: "This email already belongs to a Keycloak account." });
  const { firstName, lastName } = nameParts(name);
  let subject: string | null = null;
  try {
    const identity = await keycloakAccountProvisioner.createAccount({ username: email, email, firstName, lastName, role: ROLES.TRAINER });
    subject = identity.userId;
    await keycloakAccountProvisioner.updateIdentity(subject, { username: email, email, firstName, lastName });
    await keycloakAccountProvisioner.setRequiredActions(subject, ["UPDATE_PASSWORD"]);
    await activateRequiredActionsEmail(subject);
    const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
    const transaction = await sequelize.transaction();
    try {
      const profile = await TrainerProfile.create({ id: randomUUID(), keycloak_subject: subject, trainer_code: trainerCode, name, email, specialization, rating, certification_expired: null, status: "PENDING", first_login_at: null, activation_expires_at: expiresAt }, { transaction });
      for (const certification of certifications) await sequelize.query("INSERT INTO [dbo].[trainer_certification] ([id],[trainer_profile_id],[name],[expires_at],[created_at],[updated_at]) VALUES (:id,:trainerId,:name,:expiresAt,SYSUTCDATETIME(),SYSUTCDATETIME())", { replacements: { id: randomUUID(), trainerId: profile.id, name: certification.name.trim(), expiresAt: certification.expiresAt }, transaction });
      await appendRequestAuditTrail(req, { action: "CREATE", objectType: "TRAINER_PROFILE", objectId: profile.id, after: { trainer_code: trainerCode, name, email, specialization, rating, status: "PENDING", certifications }, processName: "trainer-create" }, transaction);
      await transaction.commit();
      return res.status(201).json({ item: { id: profile.id, trainer_code: trainerCode, name, email, specialization, rating, status: "PENDING", first_login_at: null, activation_expires_at: expiresAt, certifications } });
    } catch (error) { await transaction.rollback(); throw error; }
  } catch (error) {
    if (subject) { await keycloakAccountProvisioner.setBusinessRole(subject, ROLES.TRAINER, false).catch(() => undefined); await keycloakAccountProvisioner.deleteAccount(subject).catch(() => undefined); }
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Trainer code or email is already in use." });
    throw error;
  }
}));

trainersRouter.get("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const profile = await TrainerProfile.findByPk(req.params.id);
  if (!profile) return res.status(404).json({ message: "Trainer not found." });
  const [trainingRows, certificationMap, ratingMap] = await Promise.all([
    sequelize.query<Record<string, unknown>>(`SELECT assigned.[id], assigned.[name], assigned.[course_name], assigned.[status], MAX(assigned.[assigned_at]) AS [assigned_at] FROM (
      SELECT t.[id], t.[name], c.[name] AS [course_name], t.[status], tta.[assigned_at] FROM [dbo].[training_trainer_assignment] tta JOIN [dbo].[training] t ON t.[id] = tta.[training_id] JOIN [dbo].[course] c ON c.[id] = t.[course_id] WHERE tta.[trainer_profile_id] = :id AND tta.[ended_at] IS NULL
      UNION ALL SELECT t.[id], t.[name], c.[name] AS [course_name], t.[status], sta.[assigned_at] FROM [dbo].[session_trainer_assignment] sta JOIN [dbo].[training_session] ts ON ts.[id] = sta.[session_id] JOIN [dbo].[training] t ON t.[id] = ts.[training_id] JOIN [dbo].[course] c ON c.[id] = t.[course_id] WHERE sta.[trainer_profile_id] = :id AND sta.[ended_at] IS NULL
    ) assigned WHERE assigned.[status] IN ('SCHEDULED','ONGOING') GROUP BY assigned.[id], assigned.[name], assigned.[course_name], assigned.[status] ORDER BY MAX(assigned.[assigned_at]) DESC`, { replacements: { id: profile.id }, type: QueryTypes.SELECT }),
    loadCertifications([profile.id]),
    loadTrainerRatings([profile.id]),
  ]);
  const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
  return res.json({ item: { id: profile.id, trainer_code: profile.trainer_code, name: profile.name ?? ([identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.username), email: profile.email ?? identity.email ?? null, specialization: profile.specialization, rating: ratingMap.get(profile.id) ?? 0, status: profile.status, first_login_at: profile.first_login_at, activation_expires_at: profile.activation_expires_at, certifications: certificationMap.get(profile.id) ?? [] }, trainings: trainingRows });
}));

trainersRouter.post("/:id/resend-activation", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const profile = await TrainerProfile.findByPk(req.params.id);
  if (!profile) return res.status(404).json({ message: "Trainer not found." });
  if (profile.status !== "PENDING" || profile.first_login_at) return res.status(409).json({ message: "An activation email can only be resent to a Trainer who has not logged in." });
  if (profile.activation_expires_at && profile.activation_expires_at.getTime() > Date.now()) return res.status(409).json({ message: "The current activation link is still valid." });
  await keycloakAccountProvisioner.setRequiredActions(profile.keycloak_subject, ["UPDATE_PASSWORD"]);
  await activateRequiredActionsEmail(profile.keycloak_subject);
  const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
  const before = { activation_expires_at: profile.activation_expires_at?.toISOString() ?? null };
  await profile.update({ activation_expires_at: expiresAt });
  await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "TRAINER_PROFILE", objectId: profile.id, before, after: { activation_expires_at: expiresAt.toISOString() }, processName: "trainer-activation-resend" });
  return res.status(202).json({ message: "Activation email sent", expiresAt });
}));

trainersRouter.put("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  if (!validateInput(body, true)) return res.status(400).json({ message: "Trainer name, specialization, status, and valid certifications are required." });
  const profile = await TrainerProfile.findByPk(req.params.id);
  if (!profile) return res.status(404).json({ message: "Trainer not found." });
  if (profile.status === "PENDING" && body.status !== "PENDING") return res.status(409).json({ message: "Pending status is managed by the portal activation flow." });
  if (profile.status !== "PENDING" && body.status === "PENDING") return res.status(400).json({ message: "Pending status is managed by the portal activation flow." });
  const name = String(body.name).trim();
  const specialization = String(body.specialization).trim();
  const nextStatus = String(body.status) as "PENDING" | "ACTIVE" | "INACTIVE";
  const certifications = body.certifications as CertificationInput[];
  const previousCertifications = await sequelize.query<{ name: string; expires_at: string | Date }>(
    "SELECT [name], [expires_at] FROM [dbo].[trainer_certification] WHERE [trainer_profile_id] = :id ORDER BY [expires_at], [name]",
    { replacements: { id: profile.id }, type: QueryTypes.SELECT },
  );
  const before = {
    name: profile.name,
    specialization: profile.specialization,
    status: profile.status,
    certifications: previousCertifications.map((item) => ({ name: item.name, expiresAt: String(item.expires_at).slice(0, 10) })),
  };
  const nextCertifications = certifications.map((item) => ({ name: item.name.trim(), expiresAt: item.expiresAt }));
  const after = { name, specialization, status: nextStatus, certifications: nextCertifications };
  if (JSON.stringify(before) === JSON.stringify(after)) {
    const ratingMap = await loadTrainerRatings([profile.id]);
    return res.json({ item: { id: profile.id, trainer_code: profile.trainer_code, name, email: profile.email, specialization, rating: ratingMap.get(profile.id) ?? 0, status: nextStatus, first_login_at: profile.first_login_at } });
  }
  const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
  const changes = { name, specialization, status: nextStatus };
  const changeStatus = profile.status !== nextStatus;
  if (changeStatus) await keycloakAccountProvisioner.setBusinessRole(profile.keycloak_subject, ROLES.TRAINER, nextStatus === "ACTIVE");
  const { firstName, lastName } = nameParts(name);
  try {
    await keycloakAccountProvisioner.updateIdentity(profile.keycloak_subject, { username: identity.username, email: profile.email ?? identity.email ?? identity.username, firstName, lastName });
    const transaction = await sequelize.transaction();
    try {
      await profile.update(changes, { transaction });
      await sequelize.query("DELETE FROM [dbo].[trainer_certification] WHERE [trainer_profile_id] = :id", { replacements: { id: profile.id }, transaction });
      for (const certification of certifications) await sequelize.query("INSERT INTO [dbo].[trainer_certification] ([id],[trainer_profile_id],[name],[expires_at],[created_at],[updated_at]) VALUES (:id,:trainerId,:name,:expiresAt,SYSUTCDATETIME(),SYSUTCDATETIME())", { replacements: { id: randomUUID(), trainerId: profile.id, name: certification.name.trim(), expiresAt: certification.expiresAt }, transaction });
      await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "TRAINER_PROFILE", objectId: profile.id, before, after, processName: "trainer-update" }, transaction);
      await transaction.commit();
    } catch (error) { await transaction.rollback(); throw error; }
  } catch (error) {
    if (changeStatus) await keycloakAccountProvisioner.setBusinessRole(profile.keycloak_subject, ROLES.TRAINER, profile.status === "ACTIVE").catch(() => undefined);
    await keycloakAccountProvisioner.updateIdentity(profile.keycloak_subject, { username: identity.username, email: profile.email ?? identity.email ?? identity.username, firstName: identity.firstName ?? "", lastName: identity.lastName ?? "" }).catch(() => undefined);
    throw error;
  }
  const ratingMap = await loadTrainerRatings([profile.id]);
  return res.json({ item: { id: profile.id, trainer_code: profile.trainer_code, name, email: profile.email, specialization, rating: ratingMap.get(profile.id) ?? 0, status: nextStatus, first_login_at: profile.first_login_at } });
}));

trainersRouter.delete("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("TRAINER", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const profile = await TrainerProfile.findByPk(req.params.id);
  if (!profile) return res.status(404).json({ message: "Trainer not found." });
  const before = { trainer_code: profile.trainer_code, name: profile.name, email: profile.email, status: profile.status, keycloak_subject: profile.keycloak_subject };
  if (profile.status !== "INACTIVE") await keycloakAccountProvisioner.setBusinessRole(profile.keycloak_subject, ROLES.TRAINER, false);
  const transaction = await sequelize.transaction();
  try {
    await profile.update({ status: "INACTIVE" }, { transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "TRAINER_PROFILE", objectId: profile.id, before, after: { status: "INACTIVE", trainer_role_removed: true }, processName: "trainer-deactivate" }, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if (before.status !== "INACTIVE") await keycloakAccountProvisioner.setBusinessRole(profile.keycloak_subject, ROLES.TRAINER, true).catch(() => undefined);
    throw error;
  }
  return res.status(204).end();
}));
