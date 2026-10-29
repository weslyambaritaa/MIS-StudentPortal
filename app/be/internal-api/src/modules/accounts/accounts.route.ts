import { randomUUID } from "node:crypto";
import { Op, QueryTypes, col, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { Account, Industry, Invoice, InvoiceDetail, Participant, Quotation, QuotationOrder, RequestForm, SalesAccountAssignment, StudentMasterProfile, Training } from "../../database/models";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "./keycloak-account-provisioner";
import { accountTypeForIndustry, assertAccountDeletable, assertAccountTypeChangeAllowed } from "./account-policy";
import { studentPicClient, type PicRecord } from "../../integrations/student-api/student-api.client";

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
  const [row] = await sequelize.query<{ value: number | string | bigint }>("SELECT nextval('account_code_seq') AS value", { type: QueryTypes.SELECT, transaction });
  return `ACC-${String(row.value).padStart(6, "0")}`;
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

  const where: Record<string, unknown> = {};
  if (search) { const escaped = `%${search.replace(/[\\%_]/g, "\\$&")}%`; Object.assign(where, { [Op.or]: [{ account_code: { [Op.iLike]: escaped } }, { name: { [Op.iLike]: escaped } }] }); }
  if (industryId) where.industry_id = industryId;
  if (status !== "ALL") where.status = status;
  const { rows, count } = await Account.findAndCountAll({ where, include: [
    { model: SalesAccountAssignment, as: "salesAssignments", attributes: ["sales_subject"], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true },
    { model: Industry, as: "industry", attributes: ["industry_code", "name"], required: false },
  ], distinct: true, order: [["name", "ASC"], ["account_code", "ASC"]], limit: pageSize, offset: (page - 1) * pageSize });
  const ids = rows.map((row) => row.id);
  const [students, picResponse, trainings] = await Promise.all([
    ids.length ? StudentMasterProfile.findAll({ where: { account_id: { [Op.in]: ids }, portal_enabled: true }, attributes: ["account_id"], raw: true }) : Promise.resolve([] as Array<{ account_id: string }>),
    ids.length ? studentPicClient.list(req.auth!, { accountIds: ids }) : Promise.resolve({ items: [] as PicRecord[] }),
    ids.length ? Training.findAll({ where: { account_id: { [Op.in]: ids } }, attributes: ["account_id"], raw: true }) : Promise.resolve([] as Array<{ account_id: string }>),
  ]);
  const picAssignments = picResponse.items.flatMap((pic) => pic.assignments.filter((assignment) => !assignment.ended_at).map((assignment) => ({ account_id: assignment.account_id, name: pic.name })));
  const personalSubjects = rows.map((row) => row.personal_student_subject).filter((subject): subject is string => Boolean(subject));
  const linkedProfiles = personalSubjects.length ? await StudentMasterProfile.findAll({ where: { keycloak_subject: { [Op.in]: personalSubjects } }, attributes: ["account_id", "keycloak_subject", "portal_enabled"], raw: true }) : [];
  const items = rows.map((model) => {
    const item = model.toJSON() as Record<string, any>;
    const activeForAccount = linkedProfiles.find((profile) => profile.account_id === model.id && profile.keycloak_subject === model.personal_student_subject && profile.portal_enabled);
    const inactiveForSubject = linkedProfiles.find((profile) => profile.keycloak_subject === model.personal_student_subject && !profile.portal_enabled);
    const personalExtra = model.account_type === "PERSONAL" && model.personal_student_subject && !activeForAccount && !inactiveForSubject ? 1 : 0;
    const industry = model.get("industry") as Industry | null;
    const assignment = model.get("salesAssignments") as SalesAccountAssignment[];
    const accountPics = picAssignments.filter((pic) => pic.account_id === model.id);
    return { ...item, industry_code: industry?.industry_code ?? null, industry_name: industry?.name ?? null, sales_subject: assignment[0]?.sales_subject, student_count: students.filter((student) => student.account_id === model.id).length + personalExtra, pic_count: accountPics.length, training_count: trainings.filter((training) => training.account_id === model.id).length, pics: accountPics.map((pic) => pic.name).filter(Boolean) };
  });
  return res.json({ items, page, pageSize, total: count });
}));

accountsRouter.get("/industries", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (_req, res) => {
  const items = await Industry.findAll({ attributes: ["id", "industry_code", "name", "status"], order: [["name", "ASC"]], raw: true });
  return res.json({ items });
}));

accountsRouter.get("/:id/students", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const account = await Account.findOne({ where: { id: req.params.id }, include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] });
  if (!account) return res.status(404).json({ message: "Account not found" });
  const [rows, personalRows, masterStudents] = await Promise.all([
    Participant.findAll({ where: { student_subject: { [Op.ne]: null } }, include: [{ model: Training, as: "training", where: { account_id: req.params.id }, attributes: ["name", "status"], required: true }], order: [[{ model: Training, as: "training" }, "name", "ASC"]] }),
    Promise.resolve([{ personal_student_subject: account.personal_student_subject }]),
    StudentMasterProfile.findAll({ where: { account_id: req.params.id }, attributes: [[col("keycloak_subject"), "student_subject"], "name", "email", "student_id"], raw: true }) as unknown as Promise<Array<{ student_subject: string; name: string; email: string; student_id: string | null }>>,
  ]);
  const subjects = [...new Set([
    ...rows.map((row) => row.student_subject).filter((subject): subject is string => Boolean(subject)),
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
      ongoingTrainings: [...new Set(rows.filter((row) => row.student_subject === subject && (row.get("training") as Training).status === "ONGOING").map((row) => (row.get("training") as Training).name))],
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return res.json({ items: students, total: students.length });
}));

accountsRouter.get("/:id", authorizeActiveRole(ROLES.SALES), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const item = await Account.findOne({ where: { id: req.params.id }, include: [
    { model: SalesAccountAssignment, as: "salesAssignments", attributes: ["sales_subject"], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true },
    { model: Industry, as: "industry", attributes: ["industry_code", "name"], required: false },
  ] });
  if (!item) return res.status(404).json({ message: "Account not found" });
  const picRows = await studentPicClient.list(req.auth!, { accountId: item.id });
  const industry = item.get("industry") as Industry | null; const assignment = (item.get("salesAssignments") as SalesAccountAssignment[])[0];
  return res.json({ item: { ...item.toJSON(), industry_code: industry?.industry_code ?? null, industry_name: industry?.name ?? null, sales_subject: assignment.sales_subject }, pics: picRows.items.filter((pic) => pic.assignments.some((row) => !row.ended_at)).map((pic) => ({ subject: pic.keycloak_subject, name: pic.name, email: pic.email, status: pic.status })) });
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
    const account = await Account.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    const industry = await Industry.findByPk(industryId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!account) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const currentAssignment = await SalesAccountAssignment.findOne({ where: { account_id: account.id, ended_at: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (!currentAssignment || currentAssignment.sales_subject !== req.auth!.userId) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    if (!industry || (industry.status !== "ACTIVE" && industry.id !== account.industry_id)) { await transaction.rollback(); return res.status(400).json({ message: "Choose an active Industry" }); }
    const nextType = accountTypeForIndustry(industry.industry_code);
    if (nextType !== account.account_type) {
      const [trainingCount, participantCount] = await Promise.all([
        Training.count({ where: { account_id: account.id }, transaction }),
        Participant.count({ include: [{ model: Training, as: "training", where: { account_id: account.id }, attributes: [], required: true }], transaction }),
      ]);
      try { assertAccountTypeChangeAllowed({ linkedPersonalStudent: Boolean(account.personal_student_subject), trainingCount, participantCount }); }
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
    const account = await Account.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!account) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const owner = await SalesAccountAssignment.findOne({ where: { account_id: account.id, ended_at: null }, transaction, lock: transaction.LOCK.UPDATE });
    if (!owner || owner.sales_subject !== req.auth!.userId) { await transaction.rollback(); return res.status(404).json({ message: "Account not found" }); }
    const trainingCount = await Training.count({ where: { account_id: account.id }, transaction });
    try { assertAccountDeletable(trainingCount); }
    catch (error) { await transaction.rollback(); return res.status(409).json({ message: (error as Error).message }); }
    const linkedStudentCount = await StudentMasterProfile.count({ where: { account_id: account.id }, transaction });
    if (linkedStudentCount > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: "This Account cannot be deleted while Student profiles are linked to it. Move or delete the Student profiles first." });
    }
    await appendRequestAuditTrail(req, {
      action: "DELETE", objectType: "ACCOUNT", objectId: account.id,
      before: { account_code: account.account_code, name: account.name, account_type: account.account_type, industry_id: account.industry_id, status: account.status, personal_student_subject: account.personal_student_subject },
      processName: "account-delete",
    }, transaction);
    // Non-training references are removed only after the explicit no-Training check.
    const quotations = await Quotation.findAll({ where: { account_id: account.id }, attributes: ["id"], transaction });
    const quotationIds = quotations.map((quotation) => quotation.id);
    const invoices = await Invoice.findAll({ where: { account_id: account.id }, attributes: ["id"], transaction });
    const invoiceIds = invoices.map((invoice) => invoice.id);
    if (quotationIds.length) {
      await RequestForm.update({ quotation_id: null }, { where: { quotation_id: { [Op.in]: quotationIds } }, transaction });
      await QuotationOrder.destroy({ where: { quotation_id: { [Op.in]: quotationIds } }, transaction });
      await Quotation.destroy({ where: { id: { [Op.in]: quotationIds } }, transaction });
    }
    if (invoiceIds.length) await InvoiceDetail.destroy({ where: { invoice_id: { [Op.in]: invoiceIds } }, transaction });
    await Invoice.destroy({ where: { account_id: account.id }, transaction });
    await SalesAccountAssignment.destroy({ where: { account_id: account.id }, transaction });
    await account.destroy({ transaction });
    await transaction.commit();
    await studentPicClient.endAccountAssignments(req.auth!, account.id).catch((error: unknown) => {
      console.error("Account was deleted, but its PIC assignments could not be closed in Student API; retry the cleanup.", error);
    });
    return res.status(204).end();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

// Admin QPD may link a Student Portal identity to a Personal Account. This does not create student_profile.
accountsRouter.get("/admin/personal-links", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), asyncHandler(async (_req, res) => {
  const [accounts, students, linked] = await Promise.all([
    Account.findAll({ where: { account_type: "PERSONAL" }, attributes: ["id", "account_code", "name", "status", "personal_student_subject"], order: [["name", "ASC"]], raw: true }),
    keycloakAccountProvisioner.listRoleMembers(ROLES.STUDENT),
    Account.findAll({ where: { personal_student_subject: { [Op.ne]: null } }, attributes: ["personal_student_subject"], raw: true }),
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
