import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { env } from "../../config/env";
import { PicAccountAssignment, PicProfile } from "../../database/models";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendAuditTrail, appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import {
  KeycloakProvisioningError,
  keycloakAccountProvisioner,
} from "../accounts/keycloak-account-provisioner";

export const picManagementRouter = Router();
const ACTIVATION_LIFESPAN_SECONDS = 24 * 60 * 60;
const parsePage = (value: unknown, fallback: number, maximum: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
};
const nameParts = (name: string) => {
  const pieces = name.trim().split(/\s+/);
  return { firstName: pieces[0] ?? "", lastName: pieces.slice(1).join(" ") };
};
const publicProfile = (profile: PicProfile, account?: Record<string, unknown>) => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  status: profile.status,
  account_id: account?.id ?? null,
  account_name: account?.name ?? null,
  industry_name: account?.industry_name ?? null,
  account_status: account?.status ?? null,
});

async function isSalesAccount(accountId: string, salesSubject: string, requireActive = false) {
  const rows = await sequelize.query<{
    id: string;
    name: string;
    status: string;
    industry_name: string | null;
  }>(
    `SELECT a.id, a.name, a.status, i.name AS industry_name
     FROM account a JOIN sales_account_assignment sa ON sa.account_id = a.id
     LEFT JOIN industry i ON i.id = a.industry_id
     WHERE a.id = :accountId AND sa.sales_subject = :salesSubject AND sa.ended_at IS NULL${requireActive ? " AND a.status = 'ACTIVE'" : ""}`,
    { replacements: { accountId, salesSubject }, type: QueryTypes.SELECT }
  );
  return rows[0] ?? null;
}

async function loadPic(profileId: string, salesSubject: string) {
  const rows = await sequelize.query<{
    id: string;
    name: string;
    email: string;
    status: PicProfile["status"];
    activation_expires_at: Date | null;
    account_id: string;
    account_name: string;
    account_status: string;
    industry_name: string | null;
  }>(
    `SELECT pp.id, pp.name, pp.email, pp.status, pp.activation_expires_at, a.id AS account_id, a.name AS account_name, a.status AS account_status, i.name AS industry_name
     FROM pic_profile pp JOIN pic_account_assignment pa ON pa.pic_profile_id = pp.id AND pa.ended_at IS NULL
     JOIN account a ON a.id = pa.account_id JOIN sales_account_assignment sa ON sa.account_id = a.id AND sa.sales_subject = :salesSubject AND sa.ended_at IS NULL
     LEFT JOIN industry i ON i.id = a.industry_id WHERE pp.id = :profileId`,
    { replacements: { profileId, salesSubject }, type: QueryTypes.SELECT }
  );
  return rows[0] ?? null;
}

async function activateCompletedProfiles(profiles: PicProfile[]) {
  for (const profile of profiles) {
    if (profile.status !== "PENDING") continue;
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    if (identity.requiredActions.includes("UPDATE_PASSWORD")) continue;
    const transaction = await sequelize.transaction();
    try {
      const locked = await PicProfile.findByPk(profile.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (locked?.status === "PENDING") {
        await locked.update({ status: "ACTIVE", activation_expires_at: null }, { transaction });
        await appendAuditTrail(
          {
            action: "UPDATE",
            objectType: "PIC_PROFILE",
            objectId: locked.id,
            before: { status: "PENDING" },
            after: { status: "ACTIVE" },
            processName: "pic-activation-completed",
          },
          null,
          { transaction }
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

picManagementRouter.get(
  "/accounts",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const items = await sequelize.query<{
      id: string;
      account_code: string;
      name: string;
      industry_name: string | null;
    }>(
      `SELECT a.id, a.account_code, a.name, a.status, i.name AS industry_name FROM account a
     JOIN sales_account_assignment sa ON sa.account_id = a.id AND sa.sales_subject = :subject AND sa.ended_at IS NULL
     LEFT JOIN industry i ON i.id = a.industry_id ORDER BY a.name`,
      { replacements: { subject: req.auth!.userId }, type: QueryTypes.SELECT }
    );
    return res.json({ items });
  })
);

picManagementRouter.get(
  "/",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
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
    if (!["ALL", "PENDING", "ACTIVE", "INACTIVE"].includes(String(status)))
      return res.status(400).json({ message: "Invalid status filter" });
    const clauses = [
      "sa.sales_subject = :subject",
      "sa.ended_at IS NULL",
      "pa.ended_at IS NULL",
    ];
    const replacements: Record<string, unknown> = {
      subject: req.auth!.userId,
      offset: (page - 1) * pageSize,
      pageSize,
    };
    if (search) {
      clauses.push("(pp.name ILIKE :search ESCAPE E'\\\\' OR pp.email ILIKE :search ESCAPE E'\\\\')");
      replacements.search = `%${String(search).replace(/[\\%_]/g, "\\$&")}%`;
    }
    if (accountId) {
      clauses.push("a.id = :accountId");
      replacements.accountId = accountId;
    }
    if (status !== "ALL") {
      clauses.push("pp.status = :status");
      replacements.status = status;
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const totalRows = await sequelize.query<{ total: number | string }>(
      `SELECT COUNT(1) AS total FROM pic_profile pp JOIN pic_account_assignment pa ON pa.pic_profile_id = pp.id JOIN account a ON a.id = pa.account_id JOIN sales_account_assignment sa ON sa.account_id = a.id ${where}`,
      { replacements, type: QueryTypes.SELECT }
    );
    const rows = await sequelize.query<Record<string, unknown>>(
      `SELECT pp.id, pp.name, pp.email, pp.status, pp.activation_expires_at, a.id AS account_id, a.name AS account_name, a.status AS account_status, i.name AS industry_name
     FROM pic_profile pp JOIN pic_account_assignment pa ON pa.pic_profile_id = pp.id AND pa.ended_at IS NULL
     JOIN account a ON a.id = pa.account_id JOIN sales_account_assignment sa ON sa.account_id = a.id AND sa.sales_subject = :subject AND sa.ended_at IS NULL
     LEFT JOIN industry i ON i.id = a.industry_id ${where} ORDER BY pp.name, pp.id LIMIT :pageSize OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT }
    );
    const pending = await PicProfile.findAll({
      where: { id: rows.filter((row) => row.status === "PENDING").map((row) => row.id as string) },
    });
    await activateCompletedProfiles(pending);
    if (pending.length) {
      for (const row of rows) {
        const current = pending.find((profile) => profile.id === row.id);
        if (current?.status === "PENDING") {
          const updated = await PicProfile.findByPk(current.id);
          if (updated) row.status = updated.status;
        }
      }
    }
    return res.json({ items: rows, page, pageSize, total: Number(totalRows[0]?.total ?? 0) });
  })
);

picManagementRouter.post(
  "/",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const { name, email, accountId } = req.body ?? {};
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 200 ||
      typeof email !== "string" ||
      !/^\S+@\S+\.\S+$/.test(email.trim()) ||
      email.trim().length > 254 ||
      typeof accountId !== "string"
    ) {
      return res.status(400).json({ message: "PIC name, a valid email, and Account are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const account = await isSalesAccount(accountId, req.auth!.userId, true);
    if (!account)
      return res.status(400).json({ message: "Choose an active Account assigned to you" });
    if ((await keycloakAccountProvisioner.findUsersByEmail(normalizedEmail)).length)
      return res.status(409).json({ message: "An account with this email address already exists" });
    const { firstName, lastName } = nameParts(name);
    let identity: { userId: string } | null = null;
    try {
      const created = await keycloakAccountProvisioner.createAccount({
        username: normalizedEmail,
        email: normalizedEmail,
        firstName,
        lastName,
        role: ROLES.PIC,
      });
      identity = { userId: created.userId };
      await keycloakAccountProvisioner.updateIdentity(created.userId, {
        username: normalizedEmail,
        email: normalizedEmail,
        firstName,
        lastName,
      });
      await keycloakAccountProvisioner.setRequiredActions(created.userId, ["UPDATE_PASSWORD"]);
      await keycloakAccountProvisioner.sendRequiredActionsEmail(
        created.userId,
        ["UPDATE_PASSWORD"],
        ACTIVATION_LIFESPAN_SECONDS,
        env.keycloakPicActivationClientId,
        env.keycloakPicActivationRedirectUri
      );
      const expiresAt = new Date(Date.now() + ACTIVATION_LIFESPAN_SECONDS * 1000);
      const transaction = await sequelize.transaction();
      try {
        const profile = await PicProfile.create(
          {
            id: randomUUID(),
            keycloak_subject: created.userId,
            name: name.trim(),
            email: normalizedEmail,
            status: "PENDING",
            activation_expires_at: expiresAt,
            position: "PIC",
          },
          { transaction }
        );
        await PicAccountAssignment.create(
          {
            id: randomUUID(),
            pic_profile_id: profile.id,
            account_id: accountId,
            assigned_by_subject: req.auth!.userId,
            ended_at: null,
          },
          { transaction }
        );
        await appendRequestAuditTrail(
          req,
          {
            action: "CREATE",
            objectType: "PIC_PROFILE",
            objectId: profile.id,
            after: {
              name: profile.name,
              email: profile.email,
              status: profile.status,
              account_id: accountId,
              keycloak_subject: created.userId,
            },
            processName: "pic-create",
          },
          transaction
        );
        await transaction.commit();
        return res.status(201).json({ item: publicProfile(profile, account) });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      if (identity) {
        await keycloakAccountProvisioner
          .setBusinessRole(identity.userId, ROLES.PIC, false)
          .catch(() => undefined);
        await keycloakAccountProvisioner.deleteAccount(identity.userId).catch(() => undefined);
      }
      if (error instanceof KeycloakProvisioningError) throw error;
      throw error;
    }
  })
);

picManagementRouter.get(
  "/:id",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.VIEW),
  asyncHandler(async (req, res) => {
    const item = await loadPic(req.params.id, req.auth!.userId);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    const profile = await PicProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    if (profile.status === "PENDING") {
      await activateCompletedProfiles([profile]);
      await profile.reload();
    }
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    const trainingRows = await sequelize.query<{
      student_subject: string;
      training_name: string;
      training_status: string;
    }>(
      `SELECT DISTINCT p.student_subject, t.name AS training_name, t.status AS training_status FROM participant p JOIN training t ON t.id = p.training_id
     WHERE t.account_id = :accountId AND p.student_subject IS NOT NULL ORDER BY p.student_subject, t.name`,
      { replacements: { accountId: item.account_id }, type: QueryTypes.SELECT }
    );
    const subjects = [...new Set(trainingRows.map((row) => row.student_subject))];
    const students = subjects.length
      ? await keycloakAccountProvisioner.listRoleMembers(ROLES.STUDENT, true)
      : [];
    const studentMap = new Map(students.map((student) => [student.userId, student]));
    return res.json({
      item: { ...item, status: profile.status, email: profile.email, name: profile.name },
      students: subjects
        .map((subject) => {
          const student = studentMap.get(subject);
          return {
            subject,
            name: student
              ? [student.firstName, student.lastName].filter(Boolean).join(" ") || student.username
              : "Student account unavailable",
            ongoingTrainings: [
              ...new Set(
                trainingRows
                  .filter(
                    (row) => row.student_subject === subject && row.training_status === "ONGOING"
                  )
                  .map((row) => row.training_name)
              ),
            ],
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
      requiredActions: identity.requiredActions,
    });
  })
);

picManagementRouter.put(
  "/:id",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const { name, status, accountId } = req.body ?? {};
    if (accountId !== undefined)
      return res.status(400).json({ message: "A PIC cannot be moved to another Account" });
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 200 ||
      (status !== undefined && !["ACTIVE", "INACTIVE"].includes(String(status)))
    )
      return res
        .status(400)
        .json({ message: "A valid PIC name and optional Active/Inactive status are required" });
    const item = await loadPic(req.params.id, req.auth!.userId);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    const profile = await PicProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    if (profile.status === "PENDING") {
      await activateCompletedProfiles([profile]);
      await profile.reload();
    }
    if (profile.status === "PENDING" && status !== undefined)
      return res.status(409).json({ message: "Pending status is managed by the activation flow" });
    const nextStatus = (status ?? profile.status) as PicProfile["status"];
    if (item.account_status !== "ACTIVE" && nextStatus === "ACTIVE" && profile.status !== "ACTIVE")
      return res
        .status(409)
        .json({ message: "PIC cannot be activated while its Account is inactive" });
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    const { firstName, lastName } = nameParts(name);
    const beforeStatus = profile.status;
    const beforeName = profile.name;
    if (nextStatus !== profile.status && nextStatus !== "PENDING")
      await keycloakAccountProvisioner.setBusinessRole(
        profile.keycloak_subject,
        ROLES.PIC,
        nextStatus === "ACTIVE"
      );
    try {
      await keycloakAccountProvisioner.updateIdentity(profile.keycloak_subject, {
        username: identity.username,
        email: profile.email,
        firstName,
        lastName,
      });
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (beforeName !== name.trim()) {
        before.name = beforeName;
        after.name = name.trim();
      }
      if (beforeStatus !== nextStatus) {
        before.status = beforeStatus;
        after.status = nextStatus;
      }
      if (Object.keys(after).length === 0)
        return res.json({ item: { ...item, name: profile.name, status: profile.status } });
      const transaction = await sequelize.transaction();
      try {
        await profile.update(after, { transaction });
        await appendRequestAuditTrail(
          req,
          {
            action: "UPDATE",
            objectType: "PIC_PROFILE",
            objectId: profile.id,
            before,
            after,
            processName: "pic-update",
          },
          transaction
        );
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      return res.json({ item: { ...item, name: profile.name, status: profile.status } });
    } catch (error) {
      if (nextStatus !== beforeStatus && nextStatus !== "PENDING")
        await keycloakAccountProvisioner
          .setBusinessRole(
            profile.keycloak_subject,
            ROLES.PIC,
            beforeStatus === "ACTIVE" || beforeStatus === "PENDING"
          )
          .catch(() => undefined);
      throw error;
    }
  })
);

picManagementRouter.post(
  "/:id/resend-activation",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.EDIT),
  asyncHandler(async (req, res) => {
    const item = await loadPic(req.params.id, req.auth!.userId);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    const profile = await PicProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    if (profile.status === "PENDING") {
      await activateCompletedProfiles([profile]);
      await profile.reload();
    }
    if (profile.status !== "PENDING")
      return res.status(409).json({ message: "Only a pending PIC can receive an activation link" });
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
      objectType: "PIC_PROFILE",
      objectId: profile.id,
      before,
      after: { activation_expires_at: expiresAt.toISOString() },
      processName: "pic-activation-resend",
    });
    return res.status(202).json({ message: "Activation email sent", expiresAt });
  })
);

picManagementRouter.delete(
  "/:id",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.DELETE),
  asyncHandler(async (req, res) => {
    const item = await loadPic(req.params.id, req.auth!.userId);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    const profile = await PicProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    const businessRoles = await keycloakAccountProvisioner.getBusinessRoles(
      profile.keycloak_subject
    );
    if (businessRoles.some((role) => role !== ROLES.PIC)) {
      return res
        .status(409)
        .json({
          message:
            "This Keycloak account has another business role. Remove or transfer that role before permanently deleting the account.",
        });
    }
    // A deleted PIC must release its unique email for future provisioning. Delete the
    // Keycloak identity first; deleteAccount treats 404 as success, so the DB phase
    // can be retried safely if its transaction fails after the identity is removed.
    await keycloakAccountProvisioner.deleteAccount(profile.keycloak_subject);
    const transaction = await sequelize.transaction();
    try {
      await appendRequestAuditTrail(
        req,
        {
          action: "DELETE",
          objectType: "PIC_PROFILE",
          objectId: profile.id,
          before: {
            name: profile.name,
            email: profile.email,
            status: profile.status,
            account_id: item.account_id,
            keycloak_subject: profile.keycloak_subject,
            keycloak_account_deleted: true,
          },
          processName: "pic-delete",
        },
        transaction
      );
      await PicAccountAssignment.destroy({ where: { pic_profile_id: profile.id }, transaction });
      await profile.destroy({ transaction });
      await transaction.commit();
      return res.status(204).end();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  })
);
