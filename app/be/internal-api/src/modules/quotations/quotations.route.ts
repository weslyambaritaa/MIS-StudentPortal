import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";
import { Op, type Transaction, type WhereOptions } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { Account, Course, PicAccountAssignment, PicProfile, Quotation, QuotationDocument, QuotationOrder, SalesAccountAssignment } from "../../database/models";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendAuditTrail, appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "../accounts/keycloak-account-provisioner";
import { generateQuotationPdf, type QuotationPdfInput, type QuotationType } from "./quotation-document";
import Joi from "joi";
import { validateBody } from "../../utils/joi-validation";

export const quotationsRouter = Router();
const TYPES: QuotationType[] = ["PRIVATE", "PUBLIC", "INHOUSE", "ONLINE_PUBLIC", "ONLINE_PRIVATE"];
type LineInput = { courseId: string; amountStudent: number; pricePerPax: number; location: string };
type Input = { quotationCode: string; accountId: string; picId: string; classType: QuotationType; lines: LineInput[] };
type Quote = Quotation;
const parsePage = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;
const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
function parseInput(body: unknown): Input {
  const raw = validateBody<Record<string, unknown>>(Joi.object({
    quotationCode: Joi.string().trim().min(1).max(30).pattern(/^[^\u0000-\u001f\u007f\\<>:"|?*]+$/).required(),
    accountId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    picId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    classType: Joi.string().valid(...TYPES).required(),
    lines: Joi.array().min(1).max(30).items(Joi.object({
      courseId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
      amountStudent: Joi.number().integer().min(1).max(100000).required(),
      pricePerPax: Joi.number().positive().max(Number.MAX_SAFE_INTEGER).required(),
      location: Joi.string().trim().min(1).max(255).required(),
    }).unknown(false)).required(),
  }).unknown(false), body);
  if (typeof raw.quotationCode !== "string" || !raw.quotationCode.trim() || raw.quotationCode.trim().length > 30 || /[\u0000-\u001f\u007f\\<>:"|?*]/.test(raw.quotationCode)) throw new AppError(400, "Enter a quotation code (maximum 30 characters, without control characters or invalid filename characters)");
  if (typeof raw.accountId !== "string" || typeof raw.picId !== "string" || !TYPES.includes(raw.classType as QuotationType) || !Array.isArray(raw.lines) || raw.lines.length < 1 || raw.lines.length > 30) throw new AppError(400, "Account, active PIC, class type, and at least one course are required");
  const lines = raw.lines.map((value): LineInput => {
    if (!value || typeof value !== "object") throw new AppError(400, "Invalid course line");
    const row = value as Record<string, unknown>;
    if (typeof row.courseId !== "string" || !Number.isSafeInteger(row.amountStudent) || Number(row.amountStudent) < 1 || typeof row.pricePerPax !== "number" || !Number.isFinite(row.pricePerPax) || row.pricePerPax <= 0 || typeof row.location !== "string" || !row.location.trim() || row.location.length > 255) throw new AppError(400, "Each course requires a course, positive participant count and price, and location");
    return { courseId: row.courseId, amountStudent: Number(row.amountStudent), pricePerPax: row.pricePerPax, location: row.location.trim() };
  });
  if (new Set(lines.map((line) => line.courseId)).size !== lines.length) throw new AppError(400, "A course may only be added once to a quotation");
  return { quotationCode: raw.quotationCode.trim(), accountId: raw.accountId, picId: raw.picId, classType: raw.classType as QuotationType, lines };
}
async function assertScope(input: Omit<Input, "quotationCode">, salesSubject: string) {
  const account = await Account.findOne({ where: { id: input.accountId, status: "ACTIVE", account_type: "CORPORATE" }, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: salesSubject, ended_at: null }, required: true }] });
  if (!account) throw new AppError(400, "Select an active corporate Account assigned to you");
  const pic = await PicProfile.findOne({ where: { id: input.picId, status: "ACTIVE" }, include: [{ model: PicAccountAssignment, as: "accountAssignments", where: { account_id: input.accountId, ended_at: null }, required: true }] });
  if (!pic) throw new AppError(400, "Select an active PIC assigned to this Account");
  const courses = await Course.findAll({ where: { status: "ACTIVE", id: { [Op.in]: input.lines.map((line) => line.courseId) } }, attributes: ["id", "name", "duration_minutes"], raw: true });
  if (courses.length !== input.lines.length) throw new AppError(400, "One or more selected courses are inactive or unavailable");
  return { account, pic, courses };
}
async function assertAvailableCode(code: string, quotationId: string, transaction: Transaction) {
  // Lock the unique-index key/range until the write completes. Deleted quotation
  // codes remain reserved so historical documents can never share an identity.
  const existing = await Quotation.findOne({ where: { quotation_code: code }, attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
  if (existing && existing.id !== quotationId) throw new AppError(409, "This quotation code is already in use");
}
function configureCloudinary() {
  if (!env.cloudinaryConfigured) throw new AppError(503, "Quotation PDF storage is not configured");
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });
}
async function uploadPdf(pdf: Buffer, publicId: string) {
  configureCloudinary();
  return new Promise<{ publicId: string; assetId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: "image", type: "authenticated", format: "pdf", public_id: publicId, overwrite: false, access_mode: "authenticated" }, (error, result) => {
      if (error || !result) return reject(error ?? new Error("Cloudinary returned no upload result"));
      resolve({ publicId: result.public_id, assetId: result.asset_id });
    });
    stream.end(pdf);
  });
}
async function sendPdf(to: string, code: string, pdf: Buffer) {
  if (!env.mailHost || !env.mailUsername || !env.mailPassword || !env.mailFromAddress) throw new AppError(503, "Quotation email delivery is not configured");
  const transport = nodemailer.createTransport({ host: env.mailHost, port: env.mailPort, secure: env.mailPort === 465, auth: { user: env.mailUsername, pass: env.mailPassword }, requireTLS: env.mailEncryption === "tls" });
  await transport.sendMail({ from: { name: env.mailFromName, address: env.mailFromAddress }, to, subject: `Quotation ${code} from ExecuTrain`, text: `Dear client,\n\nPlease find attached quotation ${code}.\n\nRegards,\nExecuTrain`, attachments: [{ filename: `${code.replace(/\//g, "-")}.pdf`, content: pdf, contentType: "application/pdf" }] });
}
async function pdfData(quote: Quote, lines: LineInput[]) {
  if (!quote.created_by_subject) throw new AppError(409, "Quotation has no creator identity");
  const details = await assertScope({ accountId: quote.account_id, picId: quote.pic_profile_id, classType: quote.class_type as QuotationType, lines }, quote.created_by_subject);
  const identity = await keycloakAccountProvisioner.getIdentity(quote.created_by_subject);
  return generateQuotationPdf({ code: quote.quotation_code, accountName: details.account.name, picName: details.pic.name, picEmail: details.pic.email, salesName: [identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.username, type: quote.class_type,
    lines: lines.map((line) => { const course = details.courses.find((item) => item.id === line.courseId)!; return { name: course.name, durationMinutes: Number(course.duration_minutes), amountStudent: line.amountStudent, pricePerPax: line.pricePerPax, location: line.location }; }) });
}
async function deliver(quoteId: string, salesSubject: string) {
  const quote = await Quotation.findOne({ where: { id: quoteId, created_by_subject: salesSubject, deleted_at: null }, include: [
    { model: Account, as: "account", required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: salesSubject, ended_at: null }, required: true }] },
    { model: PicProfile, as: "pic", required: true },
  ] });
  if (!quote) throw new AppError(404, "Quotation not found");
  const picEmail = (quote.get("pic") as PicProfile).email;
  const lineRows = await QuotationOrder.findAll({ where: { quotation_id: quoteId }, attributes: ["course_id", "amount_student", "price", "location"], raw: true });
  const lines = lineRows.map((line) => ({ courseId: line.course_id, amountStudent: Number(line.amount_student), pricePerPax: Number(line.price), location: line.location ?? "" }));
  const pdf = await pdfData(quote, lines);
  const versions = await QuotationDocument.findAll({ where: { quotation_id: quoteId }, attributes: ["version"], order: [["version", "DESC"]], limit: 1, raw: true });
  const version = Number(versions[0]?.version ?? 0) + 1;
  const asset = await uploadPdf(pdf, `quotations/${quote.id}/v${version}`);
  await sendPdf(picEmail, quote.quotation_code, pdf);
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await QuotationDocument.create({ id: randomUUID(), quotation_id: quoteId, version, cloudinary_public_id: asset.publicId, cloudinary_asset_id: asset.assetId, recipient_email: picEmail, sent_at: now }, { transaction });
    await quote.update({ status: "WAITING", sent_at: now }, { transaction });
    await appendAuditTrail({ action: "UPDATE", objectType: "QUOTATION_DELIVERY", objectId: quoteId, before: { status: quote.status }, after: { status: "WAITING" }, processName: `quotation-email-sent-v${version}` }, { userId: salesSubject, activeRole: ROLES.SALES }, { transaction });
  });
  return { status: "WAITING", version, recipient: picEmail };
}

quotationsRouter.use(authorizeActiveRole(ROLES.SALES));
quotationsRouter.get("/options", authorizeCapability("QUOTATION", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const [accounts, courses] = await Promise.all([
    Account.findAll({ where: { status: "ACTIVE", account_type: "CORPORATE" }, attributes: ["id", "account_code", "name"], include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }], order: [["name", "ASC"]], raw: true }),
    Course.findAll({ where: { status: "ACTIVE" }, attributes: ["id", "name", "duration_minutes"], order: [["name", "ASC"]], raw: true }),
  ]);
  return res.json({ accounts, courses });
}));
quotationsRouter.get("/accounts/:accountId/pics", authorizeCapability("QUOTATION", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const scope = await Account.findOne({ where: { id: req.params.accountId, status: "ACTIVE", account_type: "CORPORATE" }, include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] });
  if (!scope) throw new AppError(404, "Account not found");
  const items = await PicProfile.findAll({ where: { status: "ACTIVE" }, attributes: ["id", "name", "email"], include: [{ model: PicAccountAssignment, as: "accountAssignments", attributes: [], where: { account_id: req.params.accountId, ended_at: null }, required: true }], order: [["name", "ASC"]], raw: true });
  return res.json({ items });
}));
quotationsRouter.get("/", authorizeCapability("QUOTATION", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page, 1, 1_000_000); const pageSize = parsePage(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const filters: WhereOptions = { created_by_subject: req.auth!.userId, deleted_at: null };
  if (typeof req.query.status === "string" && req.query.status !== "ALL") filters.status = req.query.status;
  if (typeof req.query.search === "string" && req.query.search.trim()) Object.assign(filters, { [Op.or]: [
    { quotation_code: { [Op.iLike]: escapeLike(req.query.search.trim()) } },
    { "$account.name$": { [Op.iLike]: escapeLike(req.query.search.trim()) } },
  ] });
  if (typeof req.query.courseId === "string" && req.query.courseId !== "ALL") filters["$orders.course_id$"] = req.query.courseId;
  const { rows, count } = await Quotation.findAndCountAll({ where: filters, attributes: ["id", "quotation_code", "class_type", "status", "sent_at", "created_at"], include: [
    { model: Account, as: "account", attributes: ["name"], required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] },
    { model: PicProfile, as: "pic", attributes: ["name"], required: false },
    { model: QuotationOrder, as: "orders", attributes: ["course_id", "amount_student", "price"], required: typeof req.query.courseId === "string" && req.query.courseId !== "ALL" },
  ], distinct: true, order: [["created_at", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize });
  const items = rows.map((quote) => {
    const orders = quote.get("orders") as QuotationOrder[];
    const account = quote.get("account") as Account;
    const pic = quote.get("pic") as PicProfile | null;
    return { id: quote.id, quotation_code: quote.quotation_code, class_type: quote.class_type, status: quote.status, sent_at: quote.sent_at, account_name: account.name, pic_name: pic?.name ?? null, course_count: orders.length, students: orders.reduce((sum, order) => sum + Number(order.amount_student), 0), amount: orders.reduce((sum, order) => sum + Number(order.amount_student) * Number(order.price), 0) };
  });
  return res.json({ items, page, pageSize, total: count });
}));
quotationsRouter.get("/:id", authorizeCapability("QUOTATION", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId, deleted_at: null }, include: [
    { model: Account, as: "account", required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] },
    { model: PicProfile, as: "pic", required: false },
  ] });
  if (!quote) throw new AppError(404, "Quotation not found");
  const [orders, documents] = await Promise.all([
    QuotationOrder.findAll({ where: { quotation_id: quote.id }, include: [{ model: Course, as: "course", attributes: ["name", "duration_minutes"], required: true }] }),
    QuotationDocument.findAll({ where: { quotation_id: quote.id }, attributes: ["version", "recipient_email", "sent_at"], order: [["version", "DESC"]], raw: true }),
  ]);
  const account = quote.get("account") as Account;
  const pic = quote.get("pic") as PicProfile | null;
  const lines = orders.map((order) => ({ id: order.id, course_id: order.course_id, course_name: (order.get("course") as Course).name, duration_minutes: (order.get("course") as Course).duration_minutes, amount_student: order.amount_student, price: order.price, location: order.location }));
  return res.json({ item: { ...quote.toJSON(), account_name: account.name, pic_name: pic?.name ?? null, pic_email: pic?.email ?? null }, lines, documents });
}));
quotationsRouter.get("/:id/documents/:version", authorizeCapability("QUOTATION", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId, deleted_at: null }, include: [{ model: Account, as: "account", include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] }] });
  const document = quote ? await QuotationDocument.findOne({ where: { quotation_id: quote.id, version: Number(req.params.version) }, attributes: ["cloudinary_public_id"] }) : null;
  if (!document) throw new AppError(404, "Quotation document not found");
  configureCloudinary();
  const url = cloudinary.utils.private_download_url(document.cloudinary_public_id, "pdf", { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 });
  return res.json({ url, expiresInSeconds: 300 });
}));
quotationsRouter.post("/", authorizeCapability("QUOTATION", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); await assertScope(input, req.auth!.userId);
  const id = randomUUID(); const code = input.quotationCode;
  await sequelize.transaction(async (transaction) => {
    await assertAvailableCode(code, id, transaction);
    const now = new Date();
    await Quotation.create({ id, account_id: input.accountId, created_by_subject: req.auth!.userId, status: "SEND_FAILED", sent_at: null, quotation_code: code, pic_profile_id: input.picId, class_type: input.classType, deleted_at: null }, { transaction });
    await QuotationOrder.bulkCreate(input.lines.map((line) => ({ id: randomUUID(), quotation_id: id, course_id: line.courseId, class_type: input.classType.startsWith("ONLINE_") ? "ONLINE" : input.classType, amount_student: line.amountStudent, price: line.pricePerPax, location: line.location })), { transaction });
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "QUOTATION", objectId: id, after: { quotation_code: code, account_id: input.accountId, pic_profile_id: input.picId, class_type: input.classType, status: "SEND_FAILED" }, processName: "quotation-create" }, transaction);
  });
  try { const delivery = await deliver(id, req.auth!.userId); return res.status(201).json({ item: { id, quotation_code: code, status: delivery.status, delivery_status: "SENT" }, message: "Quotation sent to PIC" }); }
  catch (error) { if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message, item: { id, quotation_code: code, status: "SEND_FAILED", delivery_status: "FAILED" } }); throw error; }
}));
quotationsRouter.put("/:id", authorizeCapability("QUOTATION", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); await assertScope(input, req.auth!.userId);
  const old = await Quotation.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId, deleted_at: null }, include: [{ model: Account, as: "account", required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] }] });
  if (!old) throw new AppError(404, "Quotation not found");
  await sequelize.transaction(async (transaction) => {
    await assertAvailableCode(input.quotationCode, req.params.id, transaction);
    await old.update({ quotation_code: input.quotationCode, account_id: input.accountId, pic_profile_id: input.picId, class_type: input.classType, status: "SEND_FAILED" }, { transaction });
    await QuotationOrder.destroy({ where: { quotation_id: req.params.id }, transaction });
    await QuotationOrder.bulkCreate(input.lines.map((line) => ({ id: randomUUID(), quotation_id: req.params.id, course_id: line.courseId, class_type: input.classType.startsWith("ONLINE_") ? "ONLINE" : input.classType, amount_student: line.amountStudent, price: line.pricePerPax, location: line.location })), { transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "QUOTATION", objectId: req.params.id, before: { quotation_code: old.quotation_code, account_id: old.account_id, pic_profile_id: old.pic_profile_id, class_type: old.class_type, status: old.status }, after: { quotation_code: input.quotationCode, account_id: input.accountId, pic_profile_id: input.picId, class_type: input.classType, status: "SEND_FAILED" }, processName: "quotation-edit-resend" }, transaction);
  });
  const delivery = await deliver(req.params.id, req.auth!.userId);
  return res.json({ item: { id: req.params.id, quotation_code: input.quotationCode, status: delivery.status, delivery_status: "SENT" }, message: "Updated quotation sent to PIC" });
}));
quotationsRouter.post("/:id/resend", authorizeCapability("QUOTATION", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const result = await deliver(req.params.id, req.auth!.userId); return res.json({ item: { id: req.params.id, ...result }, message: "Quotation resent" });
}));
quotationsRouter.patch("/:id/status", authorizeCapability("QUOTATION", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  if (!(["APPROVED", "CANCELLED", "REVISION"] as const).includes(req.body?.status)) throw new AppError(400, "Status must be Approved, Cancelled, or Revision");
  const quote = await Quotation.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId, deleted_at: null }, include: [{ model: Account, as: "account", required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] }] });
  if (!quote) throw new AppError(404, "Quotation not found");
  if (!["WAITING", "APPROVED", "CANCELLED", "REVISION"].includes(quote.status)) throw new AppError(409, "Only a successfully sent quotation can change status");
  const currentStatus = quote.status;
  await sequelize.transaction(async (transaction) => {
    await quote.update({ status: req.body.status }, { transaction });
    if (currentStatus !== req.body.status) await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "QUOTATION", objectId: req.params.id, before: { status: currentStatus }, after: { status: req.body.status }, processName: "quotation-status-update" }, transaction);
  });
  return res.json({ item: { id: req.params.id, status: req.body.status } });
}));
quotationsRouter.delete("/:id", authorizeCapability("QUOTATION", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const quote = await Quotation.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId, deleted_at: null }, include: [{ model: Account, as: "account", required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] }] });
  if (!quote) throw new AppError(404, "Quotation not found");
  const now = new Date(); await sequelize.transaction(async (transaction) => {
    await quote.update({ deleted_at: now }, { transaction });
    await appendRequestAuditTrail(req, { action: "SOFT_DELETE", objectType: "QUOTATION", objectId: req.params.id, before: { deleted_at: null }, after: { deleted_at: now.toISOString() }, processName: "quotation-soft-delete" }, transaction);
  });
  return res.status(204).end();
}));
