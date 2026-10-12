import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import nodemailer from "nodemailer";
import { QueryTypes, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendAuditTrail, appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import { keycloakAccountProvisioner } from "../accounts/keycloak-account-provisioner";
import { generateQuotationPdf, type QuotationPdfInput, type QuotationType } from "./quotation-document";

export const quotationsRouter = Router();
const TYPES: QuotationType[] = ["PRIVATE", "PUBLIC", "INHOUSE", "ONLINE"];
type LineInput = { courseId: string; amountStudent: number; pricePerPax: number; location: string };
type Input = { quotationCode: string; accountId: string; picId: string; classType: QuotationType; lines: LineInput[] };
type Quote = { id: string; quotation_code: string; account_id: string; created_by_subject: string; pic_profile_id: string; class_type: QuotationType; status: string; deleted_at: Date | null };
const parsePage = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;
const escapeLike = (value: string) => `%${value.replace(/[\[%_]/g, (character) => `[${character}]`)}%`;
function parseInput(body: unknown): Input {
  if (!body || typeof body !== "object") throw new AppError(400, "Quotation details are required");
  const raw = body as Record<string, unknown>;
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
  const accounts = await sequelize.query<{ id: string; name: string; account_type: string }>(
    `SELECT TOP (1) a.[id], a.[name], a.[account_type] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=a.[id]
     WHERE a.[id]=:accountId AND a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL`,
    { replacements: { accountId: input.accountId, subject: salesSubject }, type: QueryTypes.SELECT },
  );
  if (!accounts[0]) throw new AppError(400, "Select an active corporate Account assigned to you");
  const pics = await sequelize.query<{ id: string; name: string; email: string }>(
    `SELECT TOP (1) pp.[id], pp.[name], pp.[email] FROM [dbo].[pic_profile] pp JOIN [dbo].[pic_account_assignment] pa ON pa.[pic_profile_id]=pp.[id]
     WHERE pp.[id]=:picId AND pp.[status]='ACTIVE' AND pa.[account_id]=:accountId AND pa.[ended_at] IS NULL`,
    { replacements: { picId: input.picId, accountId: input.accountId }, type: QueryTypes.SELECT },
  );
  if (!pics[0]) throw new AppError(400, "Select an active PIC assigned to this Account");
  const courses = await sequelize.query<{ id: string; name: string; duration_minutes: number }>(
    `SELECT [id],[name],[duration_minutes] FROM [dbo].[course] WHERE [status]='ACTIVE' AND [id] IN (:ids)`,
    { replacements: { ids: input.lines.map((line) => line.courseId) }, type: QueryTypes.SELECT },
  );
  if (courses.length !== input.lines.length) throw new AppError(400, "One or more selected courses are inactive or unavailable");
  return { account: accounts[0], pic: pics[0], courses };
}
async function assertAvailableCode(code: string, quotationId: string, transaction: Transaction) {
  // Lock the unique-index key/range until the write completes. Deleted quotation
  // codes remain reserved so historical documents can never share an identity.
  const rows = await sequelize.query<{ id: string }>("SELECT [id] FROM [dbo].[quotation] WITH (UPDLOCK,HOLDLOCK) WHERE [quotation_code]=:code", { replacements: { code }, type: QueryTypes.SELECT, transaction });
  if (rows.some(row => row.id !== quotationId)) throw new AppError(409, "This quotation code is already in use");
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
  const details = await assertScope({ accountId: quote.account_id, picId: quote.pic_profile_id, classType: quote.class_type, lines }, quote.created_by_subject);
  const identity = await keycloakAccountProvisioner.getIdentity(quote.created_by_subject);
  return generateQuotationPdf({ code: quote.quotation_code, accountName: details.account.name, picName: details.pic.name, picEmail: details.pic.email, salesName: [identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.username, type: quote.class_type,
    lines: lines.map((line) => { const course = details.courses.find((item) => item.id === line.courseId)!; return { name: course.name, durationMinutes: Number(course.duration_minutes), amountStudent: line.amountStudent, pricePerPax: line.pricePerPax, location: line.location }; }) });
}
async function deliver(quoteId: string, salesSubject: string) {
  const rows = await sequelize.query<Quote & { account_name: string; pic_name: string; pic_email: string }>(
    `SELECT q.*,a.[name] AS [account_name],pp.[name] AS [pic_name],pp.[email] AS [pic_email] FROM [dbo].[quotation] q JOIN [dbo].[account] a ON a.[id]=q.[account_id] JOIN [dbo].[pic_profile] pp ON pp.[id]=q.[pic_profile_id]
     JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL
     WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[deleted_at] IS NULL`, { replacements: { id: quoteId, subject: salesSubject }, type: QueryTypes.SELECT });
  const quote = rows[0]; if (!quote) throw new AppError(404, "Quotation not found");
  const lineRows = await sequelize.query<{ course_id: string; amount_student: number; price: string; location: string }>("SELECT [course_id],[amount_student],[price],[location] FROM [dbo].[quotation_order] WHERE [quotation_id]=:id", { replacements: { id: quoteId }, type: QueryTypes.SELECT });
  const lines = lineRows.map((line) => ({ courseId: line.course_id, amountStudent: Number(line.amount_student), pricePerPax: Number(line.price), location: line.location }));
  const pdf = await pdfData(quote, lines);
  const versionRows = await sequelize.query<{ next_version: number | string }>("SELECT COALESCE(MAX([version]),0)+1 AS [next_version] FROM [dbo].[quotation_document] WHERE [quotation_id]=:id", { replacements: { id: quoteId }, type: QueryTypes.SELECT });
  const version = Number(versionRows[0].next_version);
  const asset = await uploadPdf(pdf, `quotations/${quote.id}/v${version}`);
  await sendPdf(quote.pic_email, quote.quotation_code, pdf);
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("INSERT INTO [dbo].[quotation_document] ([id],[quotation_id],[version],[cloudinary_public_id],[cloudinary_asset_id],[recipient_email],[sent_at],[created_at],[updated_at]) VALUES (:id,:quotationId,:version,:publicId,:assetId,:email,:sentAt,:sentAt,:sentAt)", { replacements: { id: randomUUID(), quotationId: quoteId, version, publicId: asset.publicId, assetId: asset.assetId, email: quote.pic_email, sentAt: now }, transaction });
    await sequelize.query("UPDATE [dbo].[quotation] SET [status]='WAITING',[sent_at]=:sentAt WHERE [id]=:id", { replacements: { id: quoteId, sentAt: now }, transaction });
    await appendAuditTrail({ action: "UPDATE", objectType: "QUOTATION_DELIVERY", objectId: quoteId, before: { status: quote.status }, after: { status: "WAITING" }, processName: `quotation-email-sent-v${version}` }, { userId: salesSubject, activeRole: ROLES.SALES }, { transaction });
  });
  return { status: "WAITING", version, recipient: quote.pic_email };
}

quotationsRouter.use(authorizeActiveRole(ROLES.SALES));
quotationsRouter.get("/options", authorizeCapability("QUOTATION", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const [accounts, courses] = await Promise.all([
    sequelize.query("SELECT a.[id],a.[account_code],a.[name] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=a.[id] WHERE a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL ORDER BY a.[name]", { replacements: { subject: req.auth!.userId }, type: QueryTypes.SELECT }),
    sequelize.query("SELECT [id],[name],[duration_minutes] FROM [dbo].[course] WHERE [status]='ACTIVE' ORDER BY [name]", { type: QueryTypes.SELECT }),
  ]);
  return res.json({ accounts, courses });
}));
quotationsRouter.get("/accounts/:accountId/pics", authorizeCapability("QUOTATION", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const scope = await sequelize.query("SELECT TOP (1) a.[id] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=a.[id] WHERE a.[id]=:id AND a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL", { replacements: { id: req.params.accountId, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!scope.length) throw new AppError(404, "Account not found");
  const items = await sequelize.query("SELECT pp.[id],pp.[name],pp.[email] FROM [dbo].[pic_profile] pp JOIN [dbo].[pic_account_assignment] pa ON pa.[pic_profile_id]=pp.[id] WHERE pa.[account_id]=:id AND pa.[ended_at] IS NULL AND pp.[status]='ACTIVE' ORDER BY pp.[name]", { replacements: { id: req.params.accountId }, type: QueryTypes.SELECT });
  return res.json({ items });
}));
quotationsRouter.get("/", authorizeCapability("QUOTATION", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page, 1, 1_000_000); const pageSize = parsePage(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const where = ["q.[created_by_subject]=:subject", "q.[deleted_at] IS NULL"];
  const replacements: Record<string, unknown> = { subject: req.auth!.userId, offset: (page - 1) * pageSize, pageSize };
  if (typeof req.query.search === "string" && req.query.search.trim()) { where.push("(q.[quotation_code] LIKE :search OR a.[name] LIKE :search)"); replacements.search = escapeLike(req.query.search.trim()); }
  if (typeof req.query.status === "string" && req.query.status !== "ALL") { where.push("q.[status]=:status"); replacements.status = req.query.status; }
  if (typeof req.query.courseId === "string" && req.query.courseId !== "ALL") { where.push("EXISTS (SELECT 1 FROM [dbo].[quotation_order] qo WHERE qo.[quotation_id]=q.[id] AND qo.[course_id]=:courseId)"); replacements.courseId = req.query.courseId; }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const count = await sequelize.query<{ total: number | string }>(`SELECT COUNT_BIG(1) AS [total] FROM [dbo].[quotation] q JOIN [dbo].[account] a ON a.[id]=q.[account_id] JOIN [dbo].[sales_account_assignment] qsa ON qsa.[account_id]=q.[account_id] AND qsa.[sales_subject]=:subject AND qsa.[ended_at] IS NULL ${whereSql}`, { replacements, type: QueryTypes.SELECT });
  const items = await sequelize.query<Record<string, unknown>>(`SELECT q.[id],q.[quotation_code],q.[class_type],q.[status],q.[sent_at],a.[name] AS [account_name],pp.[name] AS [pic_name],
    (SELECT COUNT(1) FROM [dbo].[quotation_order] qo WHERE qo.[quotation_id]=q.[id]) AS [course_count],
    (SELECT SUM(qo.[amount_student]) FROM [dbo].[quotation_order] qo WHERE qo.[quotation_id]=q.[id]) AS [students],
    (SELECT SUM(qo.[amount_student]*qo.[price]) FROM [dbo].[quotation_order] qo WHERE qo.[quotation_id]=q.[id]) AS [amount]
    FROM [dbo].[quotation] q JOIN [dbo].[account] a ON a.[id]=q.[account_id] JOIN [dbo].[sales_account_assignment] qsa ON qsa.[account_id]=q.[account_id] AND qsa.[sales_subject]=:subject AND qsa.[ended_at] IS NULL LEFT JOIN [dbo].[pic_profile] pp ON pp.[id]=q.[pic_profile_id] ${whereSql} ORDER BY q.[created_at] DESC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY`, { replacements, type: QueryTypes.SELECT });
  return res.json({ items, page, pageSize, total: Number(count[0]?.total ?? 0) });
}));
quotationsRouter.get("/:id", authorizeCapability("QUOTATION", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<Record<string, unknown>>("SELECT q.*,a.[name] AS [account_name],pp.[name] AS [pic_name],pp.[email] AS [pic_email] FROM [dbo].[quotation] q JOIN [dbo].[account] a ON a.[id]=q.[account_id] JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL LEFT JOIN [dbo].[pic_profile] pp ON pp.[id]=q.[pic_profile_id] WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[deleted_at] IS NULL", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Quotation not found");
  const lines = await sequelize.query<Record<string, unknown>>("SELECT qo.[id],qo.[course_id],c.[name] AS [course_name],c.[duration_minutes],qo.[amount_student],qo.[price],qo.[location] FROM [dbo].[quotation_order] qo JOIN [dbo].[course] c ON c.[id]=qo.[course_id] WHERE qo.[quotation_id]=:id", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  const documents = await sequelize.query<Record<string, unknown>>("SELECT [version],[recipient_email],[sent_at] FROM [dbo].[quotation_document] WHERE [quotation_id]=:id ORDER BY [version] DESC", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  return res.json({ item: rows[0], lines, documents });
}));
quotationsRouter.get("/:id/documents/:version", authorizeCapability("QUOTATION", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<{ cloudinary_public_id: string }>(
    `SELECT d.[cloudinary_public_id] FROM [dbo].[quotation_document] d JOIN [dbo].[quotation] q ON q.[id]=d.[quotation_id]
     JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL
     WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[deleted_at] IS NULL AND d.[version]=:version`,
    { replacements: { id: req.params.id, subject: req.auth!.userId, version: Number(req.params.version) }, type: QueryTypes.SELECT },
  );
  if (!rows[0]) throw new AppError(404, "Quotation document not found");
  configureCloudinary();
  const url = cloudinary.utils.private_download_url(rows[0].cloudinary_public_id, "pdf", { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 });
  return res.json({ url, expiresInSeconds: 300 });
}));
quotationsRouter.post("/", authorizeCapability("QUOTATION", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); await assertScope(input, req.auth!.userId);
  const id = randomUUID(); const code = input.quotationCode;
  await sequelize.transaction(async (transaction) => {
    await assertAvailableCode(code, id, transaction);
    const now = new Date();
    await sequelize.query("INSERT INTO [dbo].[quotation] ([id],[account_id],[created_by_subject],[status],[sent_at],[quotation_code],[pic_profile_id],[class_type],[deleted_at],[created_at],[updated_at]) VALUES (:id,:accountId,:subject,'SEND_FAILED',NULL,:code,:picId,:classType,NULL,:now,:now)", { replacements: { id, accountId: input.accountId, subject: req.auth!.userId, code, picId: input.picId, classType: input.classType, now }, transaction });
    for (const line of input.lines) await sequelize.query("INSERT INTO [dbo].[quotation_order] ([id],[quotation_id],[course_id],[class_type],[amount_student],[price],[location],[created_at],[updated_at]) VALUES (:id,:quoteId,:courseId,:classType,:amount,:price,:location,:now,:now)", { replacements: { id: randomUUID(), quoteId: id, courseId: line.courseId, classType: input.classType, amount: line.amountStudent, price: line.pricePerPax, location: line.location, now }, transaction });
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "QUOTATION", objectId: id, after: { quotation_code: code, account_id: input.accountId, pic_profile_id: input.picId, class_type: input.classType, status: "SEND_FAILED" }, processName: "quotation-create" }, transaction);
  });
  try { const delivery = await deliver(id, req.auth!.userId); return res.status(201).json({ item: { id, quotation_code: code, status: delivery.status, delivery_status: "SENT" }, message: "Quotation sent to PIC" }); }
  catch (error) { if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message, item: { id, quotation_code: code, status: "SEND_FAILED", delivery_status: "FAILED" } }); throw error; }
}));
quotationsRouter.put("/:id", authorizeCapability("QUOTATION", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); await assertScope(input, req.auth!.userId);
  const oldRows = await sequelize.query<Record<string, unknown>>("SELECT q.* FROM [dbo].[quotation] q JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[deleted_at] IS NULL", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  const old = oldRows[0]; if (!old) throw new AppError(404, "Quotation not found");
  await sequelize.transaction(async (transaction) => {
    await assertAvailableCode(input.quotationCode, req.params.id, transaction);
    const now = new Date();
    await sequelize.query("UPDATE [dbo].[quotation] SET [quotation_code]=:code,[account_id]=:accountId,[pic_profile_id]=:picId,[class_type]=:classType,[status]='SEND_FAILED' WHERE [id]=:id", { replacements: { code: input.quotationCode, accountId: input.accountId, picId: input.picId, classType: input.classType, id: req.params.id }, transaction });
    await sequelize.query("DELETE FROM [dbo].[quotation_order] WHERE [quotation_id]=:id", { replacements: { id: req.params.id }, transaction });
    for (const line of input.lines) await sequelize.query("INSERT INTO [dbo].[quotation_order] ([id],[quotation_id],[course_id],[class_type],[amount_student],[price],[location],[created_at],[updated_at]) VALUES (:id,:quoteId,:courseId,:classType,:amount,:price,:location,:now,:now)", { replacements: { id: randomUUID(), quoteId: req.params.id, courseId: line.courseId, classType: input.classType, amount: line.amountStudent, price: line.pricePerPax, location: line.location, now }, transaction });
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
  const rows = await sequelize.query<Quote>("SELECT q.* FROM [dbo].[quotation] q JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[deleted_at] IS NULL", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Quotation not found");
  if (rows[0].status !== "WAITING" && rows[0].status !== "APPROVED" && rows[0].status !== "CANCELLED" && rows[0].status !== "REVISION") throw new AppError(409, "Only a successfully sent quotation can change status");
  const currentStatus = rows[0].status;
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("UPDATE [dbo].[quotation] SET [status]=:status WHERE [id]=:id", { replacements: { id: req.params.id, status: req.body.status }, transaction });
    if (currentStatus !== req.body.status) await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "QUOTATION", objectId: req.params.id, before: { status: currentStatus }, after: { status: req.body.status }, processName: "quotation-status-update" }, transaction);
  });
  return res.json({ item: { id: req.params.id, status: req.body.status } });
}));
quotationsRouter.delete("/:id", authorizeCapability("QUOTATION", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<Quote>("SELECT q.* FROM [dbo].[quotation] q JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[deleted_at] IS NULL", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Quotation not found");
  const now = new Date(); await sequelize.transaction(async (transaction) => {
    await sequelize.query("UPDATE [dbo].[quotation] SET [deleted_at]=:now WHERE [id]=:id", { replacements: { id: req.params.id, now }, transaction });
    await appendRequestAuditTrail(req, { action: "SOFT_DELETE", objectType: "QUOTATION", objectId: req.params.id, before: { deleted_at: null }, after: { deleted_at: now.toISOString() }, processName: "quotation-soft-delete" }, transaction);
  });
  return res.status(204).end();
}));
