import { randomUUID } from "node:crypto";
import { Op, col, fn, where } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { Account, Participant, StudentMasterProfile, Training } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "../accounts/keycloak-account-provisioner";

export const studentManagementRouter = Router();
const ACTIVATION_LIFESPAN_SECONDS = 24 * 60 * 60;
const MAX_BULK_STUDENT_ROWS = 1000;
const parsePage = (value: unknown, fallback: number, maximum: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
};
const nameParts = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};
async function activeAccount(accountId: string) {
  return Account.findOne({ attributes: ["id", "name", "status"], where: { id: accountId, status: "ACTIVE" }, raw: true });
}

async function existingAccount(accountId: string) {
  return Account.findOne({ attributes: ["id", "name", "status"], where: { id: accountId }, raw: true });
}

type BulkStudentInput = {
  rowNumber: number;
  name: string;
  email: string;
  accountName: string;
  companyRole: string;
};
type BulkStudentValidation = BulkStudentInput & { accountId?: string; errors: string[] };

function normalizedText(value: string) {
  return value.trim().toLocaleLowerCase();
}

async function validateBulkStudents(rawRows: unknown[]): Promise<BulkStudentValidation[]> {
  const items: BulkStudentValidation[] = rawRows.map((raw, index) => {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    return {
      rowNumber:
        Number.isSafeInteger(row.rowNumber) && Number(row.rowNumber) >= 2
          ? Number(row.rowNumber)
          : index + 2,
      name: text(row.name),
      email: text(row.email).toLowerCase(),
      accountName: text(row.accountName),
      companyRole: text(row.companyRole),
      errors: [],
    };
  });

  for (const item of items) {
    if (!item.name) item.errors.push("Student Name is required.");
    else if (item.name.length > 200)
      item.errors.push("Student Name must be 200 characters or fewer.");
    if (!item.email) item.errors.push("Email is required.");
    else if (item.email.length > 254 || !/^\S+@\S+\.\S+$/.test(item.email))
      item.errors.push("Email address is invalid.");
    if (!item.accountName) item.errors.push("Account is required.");
    if (item.companyRole.length > 200)
      item.errors.push("Student Company Role must be 200 characters or fewer.");
  }

  const emailCounts = new Map<string, number>();
  for (const item of items)
    if (item.email && /^\S+@\S+\.\S+$/.test(item.email))
      emailCounts.set(item.email, (emailCounts.get(item.email) ?? 0) + 1);
  for (const item of items)
    if ((emailCounts.get(item.email) ?? 0) > 1)
      item.errors.push("Email appears more than once in this file.");

  const accounts = await Account.findAll({ attributes: ["id", "name", "status"], raw: true });
  const accountsByName = new Map<string, typeof accounts>();
  for (const account of accounts) {
    const key = normalizedText(account.name);
    accountsByName.set(key, [...(accountsByName.get(key) ?? []), account]);
  }
  for (const item of items) {
    if (!item.accountName) continue;
    const matches = accountsByName.get(normalizedText(item.accountName)) ?? [];
    const activeMatches = matches.filter((account) => account.status === "ACTIVE");
    if (activeMatches.length === 1) item.accountId = activeMatches[0].id;
    else if (activeMatches.length > 1)
      item.errors.push("Account name matches more than one active Account; use a unique name.");
    else if (matches.length) item.errors.push("Account is inactive.");
    else item.errors.push("Account was not found.");
  }

  const uniqueCandidateEmails = [
    ...new Set(
      items
        .filter(
          (item) =>
            item.email &&
            /^\S+@\S+\.\S+$/.test(item.email) &&
            !item.errors.some((error) => error.includes("more than once"))
        )
        .map((item) => item.email)
    ),
  ];
  if (uniqueCandidateEmails.length) {
    const existingProfiles = await StudentMasterProfile.findAll({
      attributes: ["email"],
      where: where(fn("LOWER", col("email")), { [Op.in]: uniqueCandidateEmails }),
      raw: true,
    });
    const profileEmails = new Set(existingProfiles.map((row) => row.email.toLowerCase()));
    const keycloakEmails = await keycloakAccountProvisioner.findUsersByEmails(
      uniqueCandidateEmails.filter((email) => !profileEmails.has(email))
    );
    for (const item of items) {
      if (profileEmails.has(item.email))
        item.errors.push("Email already belongs to a Student profile.");
      else if (keycloakEmails.has(item.email))
        item.errors.push("Email already belongs to a Keycloak account.");
    }
  }
  return items;
}

async function provisionStudentProfile(
  req: Parameters<typeof appendRequestAuditTrail>[0],
  input: { name: string; email: string; accountId: string; companyRole: string }
) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const account = await activeAccount(input.accountId);
  if (!account) throw new Error("Account is no longer active.");

  const { firstName, lastName } = nameParts(input.name);
  let identityId: string | null = null;
  try {
    const identity = await keycloakAccountProvisioner.createAccount({
      username: normalizedEmail,
      email: normalizedEmail,
      firstName,
      lastName,
      role: ROLES.STUDENT,
    });
    identityId = identity.userId;
    await keycloakAccountProvisioner.updateIdentity(identityId, {
      username: normalizedEmail,
      email: normalizedEmail,
      firstName,
      lastName,
    });
    await keycloakAccountProvisioner.setRequiredActions(identityId, ["UPDATE_PASSWORD"]);
    await keycloakAccountProvisioner.sendRequiredActionsEmail(
      identityId,
      ["UPDATE_PASSWORD"],
      ACTIVATION_LIFESPAN_SECONDS,
      env.keycloakPicActivationClientId,
      env.keycloakPicActivationRedirectUri
    );
    const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
    const transaction = await sequelize.transaction();
    try {
      const profile = await StudentMasterProfile.create(
        {
          id: randomUUID(),
          keycloak_subject: identityId,
          account_id: input.accountId,
          name: input.name.trim(),
          email: normalizedEmail,
          company_role: input.companyRole.trim() || null,
          portal_enabled: true,
          first_login_at: null,
          last_login_at: null,
          activation_expires_at: expiresAt,
        },
        { transaction }
      );
      await appendRequestAuditTrail(
        req,
        {
          action: "CREATE",
          objectType: "STUDENT_PROFILE",
          objectId: profile.id,
          after: {
            name: profile.name,
            email: profile.email,
            account_id: profile.account_id,
            company_role: profile.company_role,
            portal_status: "HAVENT_LOGIN",
            keycloak_subject: identityId,
          },
          processName: "student-create",
        },
        transaction
      );
      await transaction.commit();
      return responseStudent({
        ...profile.get({ plain: true }),
        account_name: account.name,
        account_status: account.status,
        class_history_count: 0,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    if (identityId)
      await keycloakAccountProvisioner.deleteAccount(identityId).catch(() => undefined);
    throw error;
  }
}

async function loadStudent(id: string) {
  const profile = await StudentMasterProfile.findByPk(id, { include: [{ model: Account, as: "account", attributes: ["name", "status"], required: true }] });
  if (!profile) return null;
  const account = profile.get("account") as Account;
  const historyWhere = { [Op.or]: [
    { student_subject: profile.keycloak_subject },
    ...(profile.student_id ? [{ student_id: profile.student_id }] : []),
  ] };
  const classHistoryCount = await Participant.count({ where: historyWhere });
  return {
    id: profile.id, keycloak_subject: profile.keycloak_subject, account_id: profile.account_id, name: profile.name, email: profile.email,
    company_role: profile.company_role, portal_enabled: profile.portal_enabled, first_login_at: profile.first_login_at,
    last_login_at: profile.last_login_at, activation_expires_at: profile.activation_expires_at,
    account_name: account.name, account_status: account.status, class_history_count: classHistoryCount,
  } as Record<string, unknown>;
}

function responseStudent(row: Record<string, unknown>) {
  const status = !row.portal_enabled ? "INACTIVE" : row.first_login_at ? "ACTIVE" : "HAVENT_LOGIN";
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company_role: row.company_role,
    account_id: row.account_id,
    account_name: row.account_name,
    account_status: row.account_status,
    portal_status: status,
    first_login_at: row.first_login_at,
    last_login_at: row.last_login_at,
    activation_expires_at: row.activation_expires_at,
    class_history_count: Number(row.class_history_count ?? 0),
  };
}

studentManagementRouter.get(
  "/accounts",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (_req, res) => {
    const items = await Account.findAll({ attributes: ["id", "account_code", "name"], where: { status: "ACTIVE" }, order: [["name", "ASC"]], raw: true });
    return res.json({ items });
  })
);

studentManagementRouter.post(
  "/portal-login",
  authorizeActiveRole(ROLES.STUDENT),
  asyncHandler(async (req, res) => {
    await StudentMasterProfile.update({
      first_login_at: fn("COALESCE", col("first_login_at"), fn("NOW")),
      last_login_at: fn("NOW"),
    }, { where: { keycloak_subject: req.auth!.userId, portal_enabled: true } });
    return res.status(204).end();
  })
);

studentManagementRouter.post(
  "/bulk-preview",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const rawRows = req.body?.rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0 || rawRows.length > MAX_BULK_STUDENT_ROWS) {
      return res
        .status(400)
        .json({ message: `Upload between 1 and ${MAX_BULK_STUDENT_ROWS} Student rows.` });
    }
    const items = await validateBulkStudents(rawRows);
    return res.json({
      items,
      total: items.length,
      validCount: items.filter((item) => item.errors.length === 0).length,
      rejectedCount: items.filter((item) => item.errors.length > 0).length,
    });
  })
);

studentManagementRouter.post(
  "/bulk-import",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const rawRows = req.body?.rows;
    if (!Array.isArray(rawRows) || rawRows.length === 0 || rawRows.length > MAX_BULK_STUDENT_ROWS) {
      return res
        .status(400)
        .json({ message: `Upload between 1 and ${MAX_BULK_STUDENT_ROWS} Student rows.` });
    }
    const validation = await validateBulkStudents(rawRows);
    const items: (BulkStudentValidation & {
      status: "CREATED" | "REJECTED";
      studentId?: string;
    })[] = [];
    for (const item of validation) {
      if (item.errors.length || !item.accountId) {
        items.push({ ...item, status: "REJECTED" });
        continue;
      }
      try {
        const student = await provisionStudentProfile(req, {
          name: item.name,
          email: item.email,
          accountId: item.accountId,
          companyRole: item.companyRole,
        });
        items.push({ ...item, status: "CREATED", studentId: String(student.id) });
      } catch (error) {
        items.push({
          ...item,
          errors: [error instanceof Error ? error.message : "Student could not be created."],
          status: "REJECTED",
        });
      }
    }
    const createdCount = items.filter((item) => item.status === "CREATED").length;
    return res.json({
      items,
      total: items.length,
      createdCount,
      rejectedCount: items.length - createdCount,
    });
  })
);

studentManagementRouter.get(
  "/",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const page = parsePage(req.query.page, 1, 1_000_000);
    const pageSize = parsePage(req.query.pageSize, 8, 100);
    if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
    const search = req.query.search;
    const accountId = req.query.accountId;
    const status = req.query.status ?? "ALL";
    if (search !== undefined && (typeof search !== "string" || search.length > 150))
      return res.status(400).json({ message: "Invalid search" });
    if (accountId !== undefined && (typeof accountId !== "string" || accountId.length > 50))
      return res.status(400).json({ message: "Invalid Account filter" });
    if (!["ALL", "ACTIVE", "INACTIVE", "HAVENT_LOGIN"].includes(String(status)))
      return res.status(400).json({ message: "Invalid portal status filter" });

    const pattern = search ? `%${String(search).replace(/[\\%_]/g, "\\$&")}%` : undefined;
    const where = {
      ...(pattern ? { [Op.or]: [
        { name: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        { company_role: { [Op.iLike]: pattern } },
      ] } : {}),
      ...(status === "INACTIVE" ? { portal_enabled: false } : {}),
      ...(status === "HAVENT_LOGIN" ? { portal_enabled: true, first_login_at: null } : {}),
      ...(status === "ACTIVE" ? { portal_enabled: true, first_login_at: { [Op.ne]: null } } : {}),
      ...(accountId ? { account_id: accountId } : {}),
    };
    const { count: total, rows: profiles } = await StudentMasterProfile.findAndCountAll({
      where,
      include: [{ model: Account, as: "account", attributes: ["name", "status"], required: true }],
      distinct: true,
      order: [["name", "ASC"], ["id", "ASC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const subjects = profiles.map((profile) => profile.keycloak_subject);
    const studentIds = profiles.map((profile) => profile.student_id).filter((id): id is string => Boolean(id));
    const historyRows = subjects.length || studentIds.length ? await Participant.findAll({
      attributes: ["student_subject", "student_id"],
      where: { [Op.or]: [
        ...(subjects.length ? [{ student_subject: { [Op.in]: subjects } }] : []),
        ...(studentIds.length ? [{ student_id: { [Op.in]: studentIds } }] : []),
      ] },
      raw: true,
    }) : [];
    const rows = profiles.map((profile) => {
      const account = profile.get("account") as Account;
      const classHistoryCount = historyRows.filter((participant) =>
        participant.student_subject === profile.keycloak_subject || Boolean(profile.student_id && participant.student_id === profile.student_id)
      ).length;
      return {
        ...profile.get({ plain: true }),
        account_name: account.name,
        account_status: account.status,
        class_history_count: classHistoryCount,
      } as Record<string, unknown>;
    });
    return res.json({
      items: rows.map(responseStudent),
      page,
      pageSize,
      total,
    });
  })
);

studentManagementRouter.post(
  "/",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const { name, email, accountId, companyRole } = req.body ?? {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 200 ||
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      email.trim().length > 254 ||
      typeof accountId !== "string" ||
      (companyRole !== undefined &&
        companyRole !== null &&
        (typeof companyRole !== "string" || companyRole.trim().length > 200))
    ) {
      return res
        .status(400)
        .json({ message: "Student name, a valid email, and an active Account are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const account = await activeAccount(accountId);
    if (!account) return res.status(400).json({ message: "Choose an active Account" });
    if ((await keycloakAccountProvisioner.findUsersByEmail(normalizedEmail)).length)
      return res.status(409).json({ message: "An account with this email address already exists" });
    const item = await provisionStudentProfile(req, {
      name,
      email: normalizedEmail,
      accountId,
      companyRole: typeof companyRole === "string" ? companyRole : "",
    });
    return res.status(201).json({ item });
  })
);

studentManagementRouter.get(
  "/:id",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
    const row = await loadStudent(req.params.id);
    if (!row) return res.status(404).json({ message: "Student not found" });
    const profile = await StudentMasterProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Student not found" });
    const participantRows = await Participant.findAll({
      attributes: ["training_id"],
      where: { [Op.or]: [
        { student_subject: profile.keycloak_subject },
        ...(profile.student_id ? [{ student_id: profile.student_id }] : []),
      ] },
      include: [{ model: Training, as: "training", attributes: ["id", "name", "status", "training_type"], required: true }],
    });
    const trainings = [...new Map(participantRows.map((participant) => {
      const training = participant.get("training") as Training;
      return [training.id, { id: training.id, name: training.name, status: training.status, training_type: training.training_type }];
    })).values()].sort((left, right) => left.name.localeCompare(right.name));
    return res.json({ item: responseStudent(row), trainings });
  })
);

studentManagementRouter.post(
  "/:id/resend-activation",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const profile = await StudentMasterProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Student not found" });
    if (!profile.portal_enabled || profile.first_login_at)
      return res
        .status(409)
        .json({
          message: "An activation link can only be resent to a Student who has not logged in.",
        });
    if (profile.activation_expires_at && profile.activation_expires_at.getTime() > Date.now())
      return res.status(409).json({ message: "The current activation link is still valid" });
    await keycloakAccountProvisioner.setRequiredActions(profile.keycloak_subject, [
      "UPDATE_PASSWORD",
    ]);
    await keycloakAccountProvisioner.sendRequiredActionsEmail(
      profile.keycloak_subject,
      ["UPDATE_PASSWORD"],
      ACTIVATION_LIFESPAN_SECONDS,
      env.keycloakPicActivationClientId,
      env.keycloakPicActivationRedirectUri
    );
    const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
    const before = { activation_expires_at: profile.activation_expires_at?.toISOString() ?? null };
    await profile.update({ activation_expires_at: expiresAt });
    await appendRequestAuditTrail(req, {
      action: "UPDATE",
      objectType: "STUDENT_PROFILE",
      objectId: profile.id,
      before,
      after: { activation_expires_at: expiresAt.toISOString() },
      processName: "student-activation-resend",
    });
    return res.status(202).json({ message: "Activation email sent", expiresAt });
  })
);

studentManagementRouter.put(
  "/:id",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const { name, accountId, companyRole, portalStatus } = req.body ?? {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 200 ||
      typeof accountId !== "string" ||
      (companyRole !== undefined &&
        companyRole !== null &&
        (typeof companyRole !== "string" || companyRole.trim().length > 200)) ||
      !["ACTIVE", "INACTIVE"].includes(String(portalStatus))
    )
      return res
        .status(400)
        .json({
          message: "A valid name, active Account, company role, and portal status are required",
        });
    const profile = await StudentMasterProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Student not found" });
    const account =
      accountId === profile.account_id
        ? await existingAccount(accountId)
        : await activeAccount(accountId);
    if (!account) return res.status(400).json({ message: "Choose an active Account" });

    const { firstName, lastName } = nameParts(name);
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    const previous = {
      name: profile.name,
      account_id: profile.account_id,
      company_role: profile.company_role,
      portal_enabled: profile.portal_enabled,
    };
    const nextEnabled = portalStatus === "ACTIVE";
    const changes = {
      name: name.trim(),
      account_id: accountId,
      company_role:
        typeof companyRole === "string" && companyRole.trim() ? companyRole.trim() : null,
      portal_enabled: nextEnabled,
    };
    const changedKeys = (Object.keys(changes) as (keyof typeof changes)[]).filter(
      (key) => previous[key] !== changes[key]
    );
    if (changedKeys.length === 0) {
      const current = await loadStudent(profile.id);
      return res.json({ item: responseStudent(current!) });
    }
    const beforeChanged = Object.fromEntries(changedKeys.map((key) => [key, previous[key]]));
    const afterChanged = Object.fromEntries(changedKeys.map((key) => [key, changes[key]]));
    try {
      await keycloakAccountProvisioner.updateIdentity(profile.keycloak_subject, {
        username: identity.username,
        email: profile.email,
        firstName,
        lastName,
      });
      if (profile.portal_enabled !== nextEnabled)
        await keycloakAccountProvisioner.setBusinessRole(
          profile.keycloak_subject,
          ROLES.STUDENT,
          nextEnabled
        );
    } catch (error) {
      await keycloakAccountProvisioner
        .updateIdentity(profile.keycloak_subject, {
          username: identity.username,
          email: profile.email,
          firstName: nameParts(previous.name).firstName,
          lastName: nameParts(previous.name).lastName,
        })
        .catch(() => undefined);
      throw error;
    }
    const transaction = await sequelize.transaction();
    try {
      await profile.update(changes, { transaction });
      await appendRequestAuditTrail(
        req,
        {
          action: "UPDATE",
          objectType: "STUDENT_PROFILE",
          objectId: profile.id,
          before: beforeChanged,
          after: afterChanged,
          processName: "student-update",
        },
        transaction
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      if (previous.portal_enabled !== nextEnabled)
        await keycloakAccountProvisioner
          .setBusinessRole(profile.keycloak_subject, ROLES.STUDENT, previous.portal_enabled)
          .catch(() => undefined);
      await keycloakAccountProvisioner
        .updateIdentity(profile.keycloak_subject, {
          username: identity.username,
          email: profile.email,
          firstName: nameParts(previous.name).firstName,
          lastName: nameParts(previous.name).lastName,
        })
        .catch(() => undefined);
      throw error;
    }
    const updated = await loadStudent(profile.id);
    return res.json({ item: responseStudent(updated!) });
  })
);

studentManagementRouter.delete(
  "/:id",
  authorizeActiveRole(ROLES.ADMIN),
  authorizeCapability("STUDENT", ACCESS_ACTIONS.DELETE),
  asyncHandler(async (req, res) => {
    const profile = await StudentMasterProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "Student not found" });
    const historyCount = await Participant.count({ where: { [Op.or]: [
      { student_subject: profile.keycloak_subject },
      ...(profile.student_id ? [{ student_id: profile.student_id }] : []),
    ] } });
    if (historyCount > 0)
      return res
        .status(409)
        .json({
          message: `Student cannot be deleted because this student has ${historyCount} class history record${historyCount === 1 ? "" : "s"}.`,
        });
    const roles = await keycloakAccountProvisioner.getBusinessRoles(profile.keycloak_subject);
    if (roles.some((role) => role !== ROLES.STUDENT))
      return res
        .status(409)
        .json({
          message:
            "The Keycloak account has another business role and cannot be deleted as a Student.",
        });
    await keycloakAccountProvisioner.deleteAccount(profile.keycloak_subject);
    const transaction = await sequelize.transaction();
    try {
      await appendRequestAuditTrail(
        req,
        {
          action: "DELETE",
          objectType: "STUDENT_PROFILE",
          objectId: profile.id,
          before: {
            name: profile.name,
            email: profile.email,
            account_id: profile.account_id,
            company_role: profile.company_role,
            keycloak_subject: profile.keycloak_subject,
            keycloak_account_deleted: true,
          },
          processName: "student-delete",
        },
        transaction
      );
      await Account.update({ personal_student_subject: null }, {
        where: { personal_student_subject: profile.keycloak_subject },
        transaction,
      });
      await profile.destroy({ transaction });
      await transaction.commit();
      return res.status(204).end();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);
