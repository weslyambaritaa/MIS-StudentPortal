import { randomUUID } from "node:crypto";
import { Op } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { Account, Industry, Participant, SalesAccountAssignment, Training } from "../../database/models";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendAuditTrail, appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import {
  KeycloakProvisioningError,
  keycloakAccountProvisioner,
} from "../accounts/keycloak-account-provisioner";
import { studentPicClient, type PicRecord } from "../../integrations/student-api/student-api.client";

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
const publicProfile = (profile: PicRecord, account?: Record<string, unknown>) => ({
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
  const account = await Account.findOne({
    attributes: ["id", "name", "status", "industry_id"],
    where: { id: accountId, ...(requireActive ? { status: "ACTIVE" } : {}) },
    include: [
      { model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: salesSubject, ended_at: null }, required: true },
      { model: Industry, as: "industry", attributes: ["name"], required: false },
    ],
  });
  if (!account) return null;
  const plain = account.get({ plain: true }) as Record<string, unknown> & { industry?: { name: string } | null };
  return { id: plain.id, name: plain.name, status: plain.status, industry_name: plain.industry?.name ?? null };
}

async function loadPic(profileId: string, actor: NonNullable<Parameters<typeof studentPicClient.update>[0]>) {
  const profile = await studentPicClient.get(actor, profileId);
  const activeAssignment = profile?.assignments.find((assignment) => !assignment.ended_at);
  if (!profile || !activeAssignment) return null;
  const account = await isSalesAccount(activeAssignment.account_id, actor.userId);
  if (!account) return null;
  return {
    ...profile,
    account_id: account.id,
    account_name: account.name,
    account_status: account.status,
    industry_name: account.industry_name,
  };
}

async function activateCompletedProfiles(profiles: PicRecord[], actor: NonNullable<Parameters<typeof studentPicClient.update>[0]>) {
  for (const profile of profiles) {
    if (profile.status !== "PENDING") continue;
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    if (identity.requiredActions.includes("UPDATE_PASSWORD")) continue;
    await studentPicClient.update(actor, profile.id, { status: "ACTIVE", activationExpiresAt: null });
    await appendAuditTrail({ action: "UPDATE", objectType: "PIC_PROFILE", objectId: profile.id, before: { status: "PENDING" }, after: { status: "ACTIVE" }, processName: "pic-activation-completed" }, null);
  }
}

picManagementRouter.get(
  "/accounts",
  authorizeActiveRole(ROLES.SALES),
  authorizeCapability("PIC", ACCESS_ACTIONS.CREATE),
  asyncHandler(async (req, res) => {
    const accounts = await Account.findAll({
      attributes: ["id", "account_code", "name", "status"],
      include: [
        { model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true },
        { model: Industry, as: "industry", attributes: ["name"], required: false },
      ],
      order: [["name", "ASC"]],
    });
    const items = accounts.map((account) => {
      const row = account.get({ plain: true }) as Record<string, unknown> & { industry?: { name: string } | null };
      return { id: row.id, account_code: row.account_code, name: row.name, status: row.status, industry_name: row.industry?.name ?? null };
    });
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
    const accounts = await Account.findAll({ attributes: ["id", "name", "status", "industry_id"], include: [
      { model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true },
      { model: Industry, as: "industry", attributes: ["name"], required: false },
    ] });
    const ownedAccounts = accounts.map((model) => {
      const row = model.get({ plain: true }) as Record<string, unknown> & { industry?: { name: string } | null };
      return { id: String(row.id), name: String(row.name), status: String(row.status), industry_name: row.industry?.name ?? null };
    }).filter((account) => !accountId || account.id === accountId);
    if (accountId && !ownedAccounts.length) return res.status(404).json({ message: "Account not found" });
    const profiles = ownedAccounts.length ? await studentPicClient.list(req.auth!, { accountIds: ownedAccounts.map((account) => account.id), status: String(status), search: typeof search === "string" ? search : undefined }) : { items: [] };
    const byAccount = new Map(ownedAccounts.map((account) => [account.id, account]));
    const allRows = profiles.items.flatMap((profile) => profile.assignments.filter((assignment) => !assignment.ended_at).map((assignment) => {
      const account = byAccount.get(assignment.account_id);
      return { id: profile.id, name: profile.name, email: profile.email, status: profile.status, activation_expires_at: profile.activation_expires_at, account_id: account?.id ?? null, account_name: account?.name ?? null, account_status: account?.status ?? null, industry_name: account?.industry_name ?? null, keycloak_subject: profile.keycloak_subject };
    }));
    const pending = profiles.items.filter((profile) => profile.status === "PENDING");
    await activateCompletedProfiles(pending, req.auth!);
    for (const row of allRows) {
      if (pending.some((profile) => profile.id === row.id)) {
        const current = await studentPicClient.get(req.auth!, row.id);
        if (current) row.status = current.status;
      }
    }
    const total = allRows.length;
    const items = allRows.slice((page - 1) * pageSize, page * pageSize).map(({ keycloak_subject: _subject, ...item }) => item);
    return res.json({ items, page, pageSize, total });
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
    const profileId = randomUUID();
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
      const profile = await studentPicClient.create(req.auth!, {
        id: profileId, keycloakSubject: created.userId, name: name.trim(), email: normalizedEmail,
        status: "PENDING", activationExpiresAt: expiresAt.toISOString(), position: "PIC",
        accountId, assignedBySubject: req.auth!.userId,
      });
      await appendRequestAuditTrail(req, {
        action: "CREATE", objectType: "PIC_PROFILE", objectId: profile.item.id,
        after: { name: profile.item.name, email: profile.item.email, status: profile.item.status, account_id: accountId, keycloak_subject: created.userId },
        processName: "pic-create",
      });
      return res.status(201).json({ item: publicProfile(profile.item, account) });
    } catch (error) {
      if (identity) {
        await studentPicClient.delete(req.auth!, profileId).catch(() => undefined);
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
    const item = await loadPic(req.params.id, req.auth!);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    let profile = await studentPicClient.get(req.auth!, req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    if (profile.status === "PENDING") {
      await activateCompletedProfiles([profile], req.auth!);
      profile = await studentPicClient.get(req.auth!, req.params.id);
      if (!profile) return res.status(404).json({ message: "PIC not found" });
    }
    const identity = await keycloakAccountProvisioner.getIdentity(profile.keycloak_subject);
    const participantRows = await Participant.findAll({
      attributes: ["student_subject"],
      where: { student_subject: { [Op.ne]: null } },
      include: [{ model: Training, as: "training", attributes: ["name", "status"], where: { account_id: item.account_id }, required: true }],
      order: [["student_subject", "ASC"]],
    });
    const subjects = [...new Set(participantRows.map((row) => row.student_subject).filter((subject): subject is string => Boolean(subject)))];
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
                participantRows
                  .filter((row) => row.student_subject === subject && (row.get("training") as Training).status === "ONGOING")
                  .map((row) => (row.get("training") as Training).name)
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
    const item = await loadPic(req.params.id, req.auth!);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    let profile = await studentPicClient.get(req.auth!, req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    if (profile.status === "PENDING") {
      await activateCompletedProfiles([profile], req.auth!);
      profile = await studentPicClient.get(req.auth!, req.params.id);
      if (!profile) return res.status(404).json({ message: "PIC not found" });
    }
    if (profile.status === "PENDING" && status !== undefined)
      return res.status(409).json({ message: "Pending status is managed by the activation flow" });
    const nextStatus = (status ?? profile.status) as PicRecord["status"];
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
      const updatedProfile = (await studentPicClient.update(req.auth!, profile.id, { name: name.trim(), status: nextStatus })).item;
      await appendRequestAuditTrail(req, {
        action: "UPDATE", objectType: "PIC_PROFILE", objectId: profile.id, before, after, processName: "pic-update",
      });
      return res.json({ item: { ...item, name: updatedProfile.name, status: updatedProfile.status } });
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
    const item = await loadPic(req.params.id, req.auth!);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    let profile = await studentPicClient.get(req.auth!, req.params.id);
    if (!profile) return res.status(404).json({ message: "PIC not found" });
    if (profile.status === "PENDING") {
      await activateCompletedProfiles([profile], req.auth!);
      profile = await studentPicClient.get(req.auth!, req.params.id);
      if (!profile) return res.status(404).json({ message: "PIC not found" });
    }
    if (profile.status !== "PENDING")
      return res.status(409).json({ message: "Only a pending PIC can receive an activation link" });
    if (profile.activation_expires_at && new Date(profile.activation_expires_at).getTime() > Date.now())
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
    const before = { activation_expires_at: profile.activation_expires_at ? new Date(profile.activation_expires_at).toISOString() : null };
    await studentPicClient.update(req.auth!, profile.id, { activationExpiresAt: expiresAt.toISOString() });
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
    const item = await loadPic(req.params.id, req.auth!);
    if (!item) return res.status(404).json({ message: "PIC not found" });
    const profile = await studentPicClient.get(req.auth!, req.params.id);
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
    await appendRequestAuditTrail(req, {
      action: "DELETE", objectType: "PIC_PROFILE", objectId: profile.id,
      before: { name: profile.name, email: profile.email, status: profile.status, account_id: item.account_id, keycloak_subject: profile.keycloak_subject, keycloak_account_deleted: true },
      processName: "pic-delete",
    });
    await studentPicClient.delete(req.auth!, profile.id);
    return res.status(204).end();
  })
);
