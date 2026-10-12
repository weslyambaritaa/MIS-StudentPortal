import { randomUUID } from "node:crypto";
import { QueryTypes, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { Account, Industry, SalesAccountAssignment } from "../../database/models";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "./keycloak-account-provisioner";
import { accountTypeForIndustry, assertAccountDeletable, assertAccountTypeChangeAllowed } from "./account-policy";

export const accountsRouter = Router();

const pageNumber = (value: unknown, fallback: number, max: number) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
};
const validStatus = (value: unknown): value is "ACTIVE" | "INACTIVE" => value === "ACTIVE" || value === "INACTIVE";
const displayName = (user: { firstName?: string; lastName?: string; username: string }) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;

async function nextAccountCode(transaction: Transaction) {
  const rows = await sequelize.query<{ value: number | string | bigint }>(
    "SELECT NEXT VALUE FOR [dbo].[account_code_seq] AS [value]", { type: QueryTypes.SELECT, transaction },
  );
  return `ACC-${String(rows[0].value).padStart(6, "0")}`;
}

async function getSalesUsers() {
  return keycloakAccountProvisioner.listRoleMembers(ROLES.SALES);
}

accountsRouter.get("/sales-users", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (_req, res) => {
  const users = await getSalesUsers();
  return res.json({ items: users.map((user) => ({ subject: user.userId, name: displayName(user), email: user.email ?? null })) });
}));

accountsRouter.get("/", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000);
  const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
  const search = req.query.search;
  const industryId = req.query.industryId;
  const status = req.query.status ?? "ALL";
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) return res.status(400).json({ message: "Invalid search" });
  if (industryId !== undefined && (typeof industryId !== "string" || industryId.length > 50)) return res.status(400).json({ message: "Invalid Industry filter" });
  if (status !== "ALL" && !validStatus(status)) return res.status(400).json({ message: "Invalid status filter" });

  const filters: string[] = ["sa.[sales_subject] = :subject", "sa.[ended_at] IS NULL"];
  const replacements: Record<string, unknown> = { subject: req.auth!.userId, offset: (page - 1) * pageSize, pageSize };
  if (search) {
    filters.push("(a.[account_code] LIKE :search OR a.[name] LIKE :search)");
    replacements.search = `%${search.replace(/[\[%_]/g, (character) => `[${character}]`)}%`;
  }
  if (industryId) { filters.push("a.[industry_id] = :industryId"); replacements.industryId = industryId; }
  if (status !== "ALL") { filters.push("a.[status] = :status"); replacements.status = status; }
  const where = `WHERE ${filters.join(" AND ")}`;
  const countRows = await sequelize.query<{ total: number | string }>(
    `SELECT COUNT_BIG(1) AS [total] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id] = a.[id] ${where}`,
    { replacements, type: QueryTypes.SELECT },
  );
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT a.[id], a.[account_code], a.[name], a.[account_type], a.[industry_id], i.[industry_code], i.[name] AS [industry_name], a.[status], a.[personal_student_subject], sa.[sales_subject],
       (SELECT COUNT(1) FROM [dbo].[student_master_profile] sp WHERE sp.[account_id] = a.[id] AND sp.[portal_enabled] = 1)
         + CASE WHEN a.[account_type] = 'PERSONAL' AND a.[personal_student_subject] IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM [dbo].[student_master_profile] linked_sp WHERE linked_sp.[account_id] = a.[id] AND linked_sp.[keycloak_subject] = a.[personal_student_subject] AND linked_sp.[portal_enabled] = 1)
             AND NOT EXISTS (SELECT 1 FROM [dbo].[student_master_profile] inactive_sp WHERE inactive_sp.[keycloak_subject] = a.[personal_student_subject] AND inactive_sp.[portal_enabled] = 0)
           THEN 1 ELSE 0 END AS [student_count],
       (SELECT COUNT(1) FROM [dbo].[pic_account_assignment] pa WHERE pa.[account_id] = a.[id] AND pa.[ended_at] IS NULL) AS [pic_count],
       (SELECT COUNT(1) FROM [dbo].[training] t WHERE t.[account_id] = a.[id]) AS [training_count]
     FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id] = a.[id]
     LEFT JOIN [dbo].[industry] i ON i.[id] = a.[industry_id]
     ${where} ORDER BY a.[name] ASC, a.[account_code] ASC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY`,
    { replacements, type: QueryTypes.SELECT },
  );
  const pageIds = rows.map((row) => row.id).filter((id): id is string => typeof id === "string");
  const picRows = pageIds.length ? await sequelize.query<{ account_id: string; keycloak_subject: string; name: string }>(
    "SELECT [account_id], pp.[keycloak_subject], pp.[name] FROM [dbo].[pic_account_assignment] pa JOIN [dbo].[pic_profile] pp ON pp.[id] = pa.[pic_profile_id] WHERE pa.[ended_at] IS NULL AND pa.[account_id] IN (:accountIds)",
    { replacements: { accountIds: pageIds }, type: QueryTypes.SELECT },
  ) : [];
  const items = rows.map((row) => ({
    ...row,
    student_count: Number(row.student_count ?? 0),
    pic_count: Number(row.pic_count ?? 0),
    training_count: Number(row.training_count ?? 0),
    pics: picRows.filter((pic) => pic.account_id === row.id).map((pic) => pic.name),
  }));
  return res.json({ items, page, pageSize, total: Number(countRows[0]?.total ?? 0) });
}));

accountsRouter.get("/industries", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (_req, res) => {
  const items = await Industry.findAll({ attributes: ["id", "industry_code", "name", "status"], order: [["name", "ASC"]], raw: true });
  return res.json({ items });
}));

accountsRouter.get("/:id/students", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const accountRows = await sequelize.query<{ id: string }>(
    `SELECT TOP (1) a.[id] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id] = a.[id]
     WHERE a.[id] = :id AND sa.[sales_subject] = :subject AND sa.[ended_at] IS NULL`,
    { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT },
  );
  if (!accountRows.length) return res.status(404).json({ message: "Account not found" });
  const [rows, personalRows, masterStudents] = await Promise.all([
    sequelize.query<{ student_subject: string; training_name: string; training_status: string }>(
      `SELECT p.[student_subject], t.[name] AS [training_name], t.[status] AS [training_status]
       FROM [dbo].[participant] p JOIN [dbo].[training] t ON t.[id] = p.[training_id]
       WHERE t.[account_id] = :id AND p.[student_subject] IS NOT NULL ORDER BY t.[name]`,
      { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
    ),
    sequelize.query<{ personal_student_subject: string | null }>("SELECT [personal_student_subject] FROM [dbo].[account] WHERE [id] = :id", { replacements: { id: req.params.id }, type: QueryTypes.SELECT }),
    sequelize.query<{ student_subject: string; name: string; email: string; student_id: string | null }>(
      "SELECT [keycloak_subject] AS [student_subject], [name], [email], [student_id] FROM [dbo].[student_master_profile] WHERE [account_id] = :id",
      { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
    ),
  ]);
  const subjects = [...new Set([
    ...rows.map((row) => row.student_subject),
    ...personalRows.map((row) => row.personal_student_subject).filter((subject): subject is string => Boolean(subject)),
    ...masterStudents.map((student) => student.student_subject),
  ])];
  const directory = subjects.length ? await keycloakAccountProvisioner.listRoleMembers(ROLES.STUDENT, true) : [];
  const bySubject = new Map(directory.map((user) => [user.userId, user]));
  const masterBySubject = new Map(masterStudents.map((student) => [student.student_subject, student]));
  const students = subjects.map((subject) => {
    const user = bySubject.get(subject);
    const masterStudent = masterBySubject.get(subject);
    return {
      subject,
      name: masterStudent?.name ?? (user ? displayName(user) : "Student account unavailable"),
      ongoingTrainings: [...new Set(rows.filter((row) => row.student_subject === subject && row.training_status === "ONGOING").map((row) => row.training_name))],
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return res.json({ items: students, total: students.length });
}));

accountsRouter.get("/:id", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT TOP (1) a.[id], a.[account_code], a.[name], a.[account_type], a.[industry_id], i.[industry_code], i.[name] AS [industry_name], a.[status], a.[personal_student_subject], sa.[sales_subject]
     FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id] = a.[id]
     LEFT JOIN [dbo].[industry] i ON i.[id] = a.[industry_id]
     WHERE a.[id] = :id AND sa.[sales_subject] = :subject AND sa.[ended_at] IS NULL`,
    { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT },
  );
  if (!rows.length) return res.status(404).json({ message: "Account not found" });
  const picRows = await sequelize.query<{ keycloak_subject: string; name: string; email: string; status: string }>(
    `SELECT pp.[keycloak_subject], pp.[name], pp.[email], pp.[status] FROM [dbo].[pic_account_assignment] pa JOIN [dbo].[pic_profile] pp ON pp.[id] = pa.[pic_profile_id]
     WHERE pa.[account_id] = :id AND pa.[ended_at] IS NULL`,
    { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
  );
  return res.json({ item: rows[0], pics: picRows.map(({ keycloak_subject, name, email, status }) => ({ subject: keycloak_subject, name, email, status })) });
}));

accountsRouter.post("/", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const { name, industryId } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200 || typeof industryId !== "string") {
    return res.status(400).json({ message: "Account name and Industry are required" });
  }
  const transaction = await sequelize.transaction();
  try {
    const industry = await Industry.findByPk(industryId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!industry || industry.status !== "ACTIVE") { await transaction.rollback(); return res.status(400).json({ message: "Choose an active Industry" }); }
    const accountType = accountTypeForIndustry(industry.industry_code);
    const item = await Account.create({
      id: randomUUID(), account_code: await nextAccountCode(transaction), name: name.trim(), account_type: accountType,
      industry_id: industry.id, personal_student_subject: null, status: "ACTIVE",
    }, { transaction });
    await SalesAccountAssignment.create({ id: randomUUID(), sales_subject: req.auth!.userId, account_id: item.id, assigned_by_subject: req.auth!.userId, ended_at: null }, { transaction });
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "ACCOUNT", objectId: item.id, after: { account_code: item.account_code, name: item.name, industry_id: item.industry_id, account_type: item.account_type, status: item.status, sales_subject: req.auth!.userId }, processName: "account-create" }, transaction);
    await transaction.commit();
    return res.status(201).json({ item, sales_subject: req.auth!.userId });
  } catch (error) {
    await transaction.rollback();
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Account code or linked Student already exists" });
    throw error;
  }
}));

accountsRouter.put("/:id", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const { name, industryId, status, salesSubject } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200 || typeof industryId !== "string" || !validStatus(status) || (salesSubject !== undefined && typeof salesSubject !== "string")) {
    return res.status(400).json({ message: "Account name, active Industry, status, and Sales owner are required" });
  }
  const transaction = await sequelize.transaction();
  try {
    const rows = await sequelize.query<Record<string, unknown>>(
      `SELECT TOP (1) a.* FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id] = a.[id]
       WHERE a.[id] = :id AND sa.[sales_subject] = :subject AND sa.[ended_at] IS NULL`,
      { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT, transaction },
    );
    if (!rows.length) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const account = await Account.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    const industry = await Industry.findByPk(industryId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!account) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const currentAssignment = await SalesAccountAssignment.findOne({ where: { account_id: account.id, ended_at: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (!currentAssignment || currentAssignment.sales_subject !== req.auth!.userId) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    if (!industry || (industry.status !== "ACTIVE" && industry.id !== account.industry_id)) { await transaction.rollback(); return res.status(400).json({ message: "Choose an active Industry" }); }
    const nextType = accountTypeForIndustry(industry.industry_code);
    if (nextType !== account.account_type) {
      const [trainingRows, participantRows] = await Promise.all([
        sequelize.query<{ count: number | string }>("SELECT COUNT_BIG(1) AS [count] FROM [dbo].[training] WHERE [account_id] = :id", { replacements: { id: account.id }, type: QueryTypes.SELECT, transaction }),
        sequelize.query<{ count: number | string }>("SELECT COUNT_BIG(1) AS [count] FROM [dbo].[participant] p JOIN [dbo].[training] t ON t.[id] = p.[training_id] WHERE t.[account_id] = :id", { replacements: { id: account.id }, type: QueryTypes.SELECT, transaction }),
      ]);
      try { assertAccountTypeChangeAllowed({ linkedPersonalStudent: Boolean(account.personal_student_subject), trainingCount: Number(trainingRows[0]?.count ?? 0), participantCount: Number(participantRows[0]?.count ?? 0) }); }
      catch (error) { await transaction.rollback(); return res.status(409).json({ message: (error as Error).message }); }
    }
    const targetSubject = salesSubject ?? req.auth!.userId;
    const salesUsers = await getSalesUsers();
    if (!salesUsers.some((user) => user.userId === targetSubject)) { await transaction.rollback(); return res.status(400).json({ message: "The selected owner is not an active Sales user" }); }
    const oldOwner = currentAssignment.sales_subject;
    const before = { name: account.name, industry_id: account.industry_id, account_type: account.account_type, status: account.status, sales_subject: oldOwner };
    const changed = { name: name.trim(), industry_id: industry.id, account_type: nextType, status, sales_subject: targetSubject };
    if (oldOwner !== targetSubject) {
      await currentAssignment.update({ ended_at: new Date(), ended_by_subject: req.auth!.userId }, { transaction });
      await SalesAccountAssignment.create({ id: randomUUID(), sales_subject: targetSubject, account_id: account.id, assigned_by_subject: req.auth!.userId, ended_at: null }, { transaction });
    }
    const after = { ...changed };
    await account.update({ name: changed.name, industry_id: changed.industry_id, account_type: changed.account_type, status: changed.status }, { transaction });
    const beforeChanged: Record<string, unknown> = {};
    const afterChanged: Record<string, unknown> = {};
    for (const key of Object.keys(after) as (keyof typeof after)[]) {
      if (before[key] !== after[key]) { beforeChanged[key] = before[key]; afterChanged[key] = after[key]; }
    }
    if (Object.keys(afterChanged).length) await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "ACCOUNT", objectId: account.id, before: beforeChanged, after: afterChanged, processName: "account-update" }, transaction);
    await transaction.commit();
    return res.json({ item: { ...account.toJSON(), sales_subject: targetSubject } });
  } catch (error) {
    await transaction.rollback();
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Account ownership conflict" });
    throw error;
  }
}));

accountsRouter.delete("/:id", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const rows = await sequelize.query<Record<string, unknown>>(
      `SELECT TOP (1) a.* FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id] = a.[id]
       WHERE a.[id] = :id AND sa.[sales_subject] = :subject AND sa.[ended_at] IS NULL`,
      { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT, transaction },
    );
    const found = rows[0];
    if (!found) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const account = await Account.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!account) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const owner = await SalesAccountAssignment.findOne({ where: { account_id: account.id, ended_at: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (!owner || owner.sales_subject !== req.auth!.userId) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const trainingRows = await sequelize.query<{ count: number | string }>(
      "SELECT COUNT_BIG(1) AS [count] FROM [dbo].[training] WHERE [account_id] = :id",
      { replacements: { id: req.params.id }, type: QueryTypes.SELECT, transaction },
    );
    try { assertAccountDeletable(Number(trainingRows[0]?.count ?? 0)); }
    catch (error) { await transaction.rollback(); return res.status(409).json({ message: (error as Error).message }); }
    const linkedStudentRows = await sequelize.query<{ count: number | string }>(
      "SELECT COUNT_BIG(1) AS [count] FROM [dbo].[student_master_profile] WHERE [account_id] = :id",
      { replacements: { id: req.params.id }, type: QueryTypes.SELECT, transaction },
    );
    if (Number(linkedStudentRows[0]?.count ?? 0) > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: "This Account cannot be deleted while Student profiles are linked to it. Move or delete the Student profiles first." });
    }
    await appendRequestAuditTrail(req, {
      action: "DELETE", objectType: "ACCOUNT", objectId: account.id,
      before: { account_code: account.account_code, name: account.name, account_type: account.account_type, industry_id: account.industry_id, status: account.status, personal_student_subject: account.personal_student_subject },
      processName: "account-delete",
    }, transaction);
    // Non-training references are removed only after the explicit no-Training check.
    await sequelize.query("DELETE pa FROM [dbo].[pic_account_assignment] pa WHERE pa.[account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("DELETE FROM [dbo].[sales_account_assignment] WHERE [account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("DELETE d FROM [dbo].[invoice_detail] d JOIN [dbo].[invoice] i ON i.[id] = d.[invoice_id] WHERE i.[account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("DELETE FROM [dbo].[invoice] WHERE [account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("DELETE qo FROM [dbo].[quotation_order] qo JOIN [dbo].[quotation] q ON q.[id] = qo.[quotation_id] WHERE q.[account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("UPDATE rf SET [quotation_id] = NULL FROM [dbo].[request_form] rf JOIN [dbo].[quotation] q ON q.[id] = rf.[quotation_id] WHERE q.[account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("DELETE FROM [dbo].[quotation] WHERE [account_id] = :id", { replacements: { id: req.params.id }, transaction });
    await sequelize.query("DELETE FROM [dbo].[account] WHERE [id] = :id", { replacements: { id: req.params.id }, transaction });
    await transaction.commit();
    return res.status(204).end();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

// Admin QPD may link a Student Portal identity to a Personal Account. This does not create student_profile.
accountsRouter.get("/admin/personal-links", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (_req, res) => {
  const [accounts, students, linked] = await Promise.all([
    sequelize.query<Record<string, unknown>>("SELECT [id], [account_code], [name], [status], [personal_student_subject] FROM [dbo].[account] WHERE [account_type] = 'PERSONAL' ORDER BY [name]", { type: QueryTypes.SELECT }),
    keycloakAccountProvisioner.listRoleMembers(ROLES.STUDENT),
    sequelize.query<{ personal_student_subject: string }>("SELECT [personal_student_subject] FROM [dbo].[account] WHERE [personal_student_subject] IS NOT NULL", { type: QueryTypes.SELECT }),
  ]);
  const linkedSubjects = new Set(linked.map((row) => row.personal_student_subject));
  return res.json({
    accounts: accounts.map((item) => ({ ...item, student_name: students.find((student) => student.userId === item.personal_student_subject) ? displayName(students.find((student) => student.userId === item.personal_student_subject)!) : null })),
    students: students.filter((student) => !linkedSubjects.has(student.userId)).map((student) => ({ subject: student.userId, name: displayName(student), username: student.username, email: student.email ?? null })),
  });
}));

accountsRouter.put("/admin/personal-links/:accountId", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const studentSubject = req.body?.studentSubject;
  if (typeof studentSubject !== "string" || !studentSubject.trim() || studentSubject.length > 255) return res.status(400).json({ message: "A Student Keycloak subject is required" });
  const students = await keycloakAccountProvisioner.listRoleMembers(ROLES.STUDENT);
  const student = students.find((candidate) => candidate.userId === studentSubject);
  if (!student) return res.status(400).json({ message: "Selected identity is not an enabled Keycloak Student" });
  const transaction = await sequelize.transaction();
  try {
    const account = await Account.findByPk(req.params.accountId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!account || account.account_type !== "PERSONAL") { await transaction.rollback(); return res.status(404).json({ message: "Personal Account not found" }); }
    const before = { personal_student_subject: account.personal_student_subject };
    if (before.personal_student_subject === studentSubject) { await transaction.commit(); return res.json({ item: account }); }
    await account.update({ personal_student_subject: studentSubject }, { transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "ACCOUNT_PERSONAL_STUDENT", objectId: account.id, before, after: { personal_student_subject: studentSubject }, processName: "personal-account-student-link" }, transaction);
    await transaction.commit();
    return res.json({ item: account, student: { subject: student.userId, name: displayName(student) } });
  } catch (error) {
    await transaction.rollback();
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Student is already linked to another Personal Account" });
    throw error;
  }
}));
