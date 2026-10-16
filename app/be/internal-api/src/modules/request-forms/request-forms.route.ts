import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { QueryTypes, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";

export const requestFormsRouter = Router();
export const requestFormReviewRouter = Router();

const DELIVERY_TYPES = ["PUBLIC", "PRIVATE", "INHOUSE", "ONLINE_PUBLIC", "ONLINE_PRIVATE"] as const;
const SERVICE_TYPES = ["STANDARD", "CUSTOMIZED", "CEO"] as const;
const ROOM_SERVICES = ["INTERNET", "LAN", "SNACKS", "LUNCH"] as const;
const ALLOWED_FILE_TYPES: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
type DeliveryType = typeof DELIVERY_TYPES[number];
type ServiceType = typeof SERVICE_TYPES[number];
type SessionInput = { date: string };
type CourseInput = { courseId: string; amountStudent: number; deliveryType: DeliveryType; serviceType: ServiceType; language: string; roomRental: boolean | null; roomPc: "WITH" | "WITHOUT" | null; roomServices: typeof ROOM_SERVICES[number][]; specialInstruction: string; sessions: SessionInput[] };
type AttachmentInput = { fileName: string; contentBase64: string };
type FormInput = { formType: "REQUEST" | "REGISTRATION"; quotationId: string | null; accountId: string; picId: string; poReference: string; trainingTitle: string; courses: CourseInput[] };
type QuoteLine = { course_id: string; amount_student: number; class_type: DeliveryType; course_name: string; duration_minutes: number };
type RequestFormRow = { id: string; quotation_id: string | null; account_id: string; pic_profile_id: string; created_by_subject: string; status: "DRAFT" | "WAITING" | "REVISION" | "APPROVED"; review_note: string | null; po_reference: string | null; account_name?: string; pic_name?: string; quotation_code?: string; created_at: Date; updated_at: Date };

const pageNumber = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;
const escapeLike = (value: string) => `%${value.replace(/[\[%_]/g, (character) => `[${character}]`)}%`;
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function parseInput(body: unknown): FormInput {
  if (!body || typeof body !== "object") throw new AppError(400, "Request Form details are required");
  const raw = body as Record<string, unknown>;
  const formType = raw.formType === "REGISTRATION" ? "REGISTRATION" : raw.formType === "REQUEST" || raw.formType === undefined ? "REQUEST" : null;
  if (!formType) throw new AppError(400, "Invalid form type");
  const quotationId = raw.quotationId === null || raw.quotationId === undefined || raw.quotationId === "" ? null : raw.quotationId;
  if (quotationId !== null && !isUuid(quotationId)) throw new AppError(400, "Select a valid approved Quotation");
  if ((!quotationId && (!isUuid(raw.accountId) || !isUuid(raw.picId))) || (quotationId && ((raw.accountId !== undefined && raw.accountId !== "" && !isUuid(raw.accountId)) || (raw.picId !== undefined && raw.picId !== "" && !isUuid(raw.picId)))) || !Array.isArray(raw.courses) || raw.courses.length < 1 || raw.courses.length > 30) throw new AppError(400, "Select an Account, PIC, and at least one Course");
  if (raw.poReference !== undefined && (typeof raw.poReference !== "string" || raw.poReference.length > 150)) throw new AppError(400, "PO/SPK reference must be 150 characters or fewer");
  const courses = raw.courses.map((entry): CourseInput => {
    if (!entry || typeof entry !== "object") throw new AppError(400, "Invalid Course detail");
    const course = entry as Record<string, unknown>;
    if (!isUuid(course.courseId) || !Number.isSafeInteger(course.amountStudent) || Number(course.amountStudent) < 1 || !DELIVERY_TYPES.includes(course.deliveryType as DeliveryType) || !SERVICE_TYPES.includes(course.serviceType as ServiceType) || typeof course.language !== "string" || !course.language.trim() || course.language.length > 50 || (course.roomRental !== null && typeof course.roomRental !== "boolean") || (course.roomPc !== null && course.roomPc !== "WITH" && course.roomPc !== "WITHOUT") || (course.roomRental && course.roomPc === null) || !Array.isArray(course.roomServices) || course.roomServices.some((service) => !ROOM_SERVICES.includes(service as typeof ROOM_SERVICES[number])) || (course.specialInstruction !== undefined && (typeof course.specialInstruction !== "string" || course.specialInstruction.length > 4000)) || !Array.isArray(course.sessions) || course.sessions.length > 100) throw new AppError(400, "Enter valid Course details, class options, and session schedule");
    const sessions = course.sessions.flatMap((session): SessionInput[] => {
      if (!session || typeof session !== "object") throw new AppError(400, "Invalid session schedule");
      const value = session as Record<string, unknown>;
      if (value.date === "") return [];
      if (!validDate(value.date)) throw new AppError(400, "Each session requires a valid date");
      return [{ date: value.date }];
    });
    if (new Set(sessions.map((session) => session.date)).size !== sessions.length) throw new AppError(400, "A date can only be selected once for each Course");
    const roomRental = course.roomRental as boolean | null;
    const roomServices = [...new Set(course.roomServices as typeof ROOM_SERVICES[number][])];
    return { courseId: course.courseId, amountStudent: Number(course.amountStudent), deliveryType: course.deliveryType as DeliveryType, serviceType: course.serviceType as ServiceType, language: course.language.trim(), roomRental, roomPc: roomRental === true ? course.roomPc as "WITH" | "WITHOUT" | null : null, roomServices: roomRental === true ? roomServices : [], specialInstruction: typeof course.specialInstruction === "string" ? course.specialInstruction.trim() : "", sessions };
  });
  if (new Set(courses.map((course) => course.courseId)).size !== courses.length) throw new AppError(400, "A Course may only be added once to a Request Form");
  return { formType, quotationId: quotationId as string | null, accountId: typeof raw.accountId === "string" ? raw.accountId : "", picId: typeof raw.picId === "string" ? raw.picId : "", poReference: typeof raw.poReference === "string" ? raw.poReference.trim() : "", trainingTitle: typeof raw.trainingTitle === "string" ? raw.trainingTitle.trim() : "", courses };
}

async function deriveTrainingTitle(courses: CourseInput[]) {
  const rows = await sequelize.query<{ id: string; name: string }>("SELECT [id],[name] FROM [dbo].[course] WHERE [id] IN (:ids)", { replacements: { ids: courses.map((course) => course.courseId) }, type: QueryTypes.SELECT });
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const title = courses.map((course) => names.get(course.courseId)).filter(Boolean).join(" + ");
  if (!title || title.length > 255) throw new AppError(400, "Could not create a Training Title from the selected Courses");
  return title;
}

async function validateAccountAndPic(accountId: string, picId: string, salesSubject: string) {
  const rows = await sequelize.query("SELECT TOP (1) a.[id] AS [account_id],pp.[id] AS [pic_id] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=a.[id] JOIN [dbo].[pic_account_assignment] pa ON pa.[account_id]=a.[id] AND pa.[ended_at] IS NULL JOIN [dbo].[pic_profile] pp ON pp.[id]=pa.[pic_profile_id] WHERE a.[id]=:accountId AND a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL AND pp.[id]=:picId AND pp.[status]='ACTIVE'", { replacements: { accountId, picId, subject: salesSubject }, type: QueryTypes.SELECT });
  if (!rows.length) throw new AppError(400, "Choose an active Account assigned to you and an active PIC belonging to that Account");
}

async function approvedQuotation(quotationId: string, salesSubject: string) {
  const rows = await sequelize.query<RequestFormRow & { class_type: string; account_name: string; pic_name: string; pic_email: string }>("SELECT TOP (1) q.[id],q.[account_id],q.[pic_profile_id],q.[created_by_subject],q.[status],q.[quotation_code],q.[class_type],a.[name] AS [account_name],pp.[name] AS [pic_name],pp.[email] AS [pic_email] FROM [dbo].[quotation] q JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL JOIN [dbo].[account] a ON a.[id]=q.[account_id] AND a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' JOIN [dbo].[pic_profile] pp ON pp.[id]=q.[pic_profile_id] AND pp.[status]='ACTIVE' JOIN [dbo].[pic_account_assignment] pa ON pa.[pic_profile_id]=pp.[id] AND pa.[account_id]=a.[id] AND pa.[ended_at] IS NULL WHERE q.[id]=:id AND q.[created_by_subject]=:subject AND q.[status]='APPROVED' AND q.[deleted_at] IS NULL", { replacements: { id: quotationId, subject: salesSubject }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(400, "Only an active Approved Quotation assigned to you can be selected");
  const lines = await sequelize.query<QuoteLine>("SELECT qo.[course_id],qo.[amount_student],qo.[class_type],c.[name] AS [course_name],c.[duration_minutes] FROM [dbo].[quotation_order] qo JOIN [dbo].[course] c ON c.[id]=qo.[course_id] WHERE qo.[quotation_id]=:id", { replacements: { id: quotationId }, type: QueryTypes.SELECT });
  if (!lines.length) throw new AppError(409, "The approved Quotation has no Course details");
  return { quote: rows[0], lines };
}

async function validateCourses(courses: CourseInput[], allowInactive = false) {
  const rows = await sequelize.query<{ id: string }>(`SELECT [id] FROM [dbo].[course] WHERE ${allowInactive ? "1=1 AND" : "[status]='ACTIVE' AND"} [id] IN (:ids)`, { replacements: { ids: courses.map((course) => course.courseId) }, type: QueryTypes.SELECT });
  if (rows.length !== courses.length) throw new AppError(400, "One or more Courses are inactive or unavailable");
}

async function readForm(id: string, subject?: string) {
  const whereOwner = subject ? "AND rf.[created_by_subject]=:subject" : "";
  const rows = await sequelize.query<RequestFormRow & { account_name: string; pic_name: string; pic_email: string; quotation_code: string | null }>(
    `SELECT rf.*,a.[name] AS [account_name],pp.[name] AS [pic_name],pp.[email] AS [pic_email],q.[quotation_code],q.[class_type] AS [quotation_class_type]
       FROM [dbo].[request_form] rf JOIN [dbo].[account] a ON a.[id]=rf.[account_id] JOIN [dbo].[pic_profile] pp ON pp.[id]=rf.[pic_profile_id]
       LEFT JOIN [dbo].[quotation] q ON q.[id]=rf.[quotation_id] WHERE rf.[id]=:id ${whereOwner}`,
    { replacements: { id, ...(subject ? { subject } : {}) }, type: QueryTypes.SELECT },
  );
  if (!rows[0]) throw new AppError(404, "Request Form not found");
  const courses = await sequelize.query<Record<string, unknown>>("SELECT rfc.*,c.[name] AS [course_name],c.[duration_minutes] FROM [dbo].[request_form_course] rfc JOIN [dbo].[course] c ON c.[id]=rfc.[course_id] WHERE rfc.[request_form_id]=:id ORDER BY c.[name]", { replacements: { id }, type: QueryTypes.SELECT });
  const attachments = await sequelize.query<Record<string, unknown>>("SELECT [id],[file_name],[file_size],[file_format],[cloudinary_public_id],[created_at] FROM [dbo].[request_form_attachment] WHERE [request_form_id]=:id ORDER BY [created_at]", { replacements: { id }, type: QueryTypes.SELECT });
  const courseIds = courses.map((course) => String(course.id));
  const sessions = courseIds.length ? await sequelize.query<Record<string, unknown>>("SELECT * FROM [dbo].[request_form_session] WHERE [request_form_course_id] IN (:ids) ORDER BY [requested_date]", { replacements: { ids: courseIds }, type: QueryTypes.SELECT }) : [];
  const withSessions = courses.map((course) => ({ ...course, room_services: JSON.parse(String(course.room_services || "[]")) as string[], sessions: sessions.filter((session) => session.request_form_course_id === course.id).map((session) => ({ id: session.id, date: session.requested_date })) }));
  return { item: rows[0], courses: withSessions, attachments: attachments.map(({ cloudinary_public_id: publicId, ...attachment }) => ({ ...attachment, download_url: requestFormDownloadUrl(String(publicId), String(attachment.file_format)) })) };
}

async function saveCourses(requestFormId: string, courses: CourseInput[], transaction: Transaction) {
  for (const course of courses) {
    const courseRowId = randomUUID(); const now = new Date();
    await sequelize.query("INSERT INTO [dbo].[request_form_course] ([id],[request_form_id],[course_id],[delivery_type],[service_type],[amount_student],[language],[room_rental],[room_pc],[room_services],[special_instruction],[created_at],[updated_at]) VALUES (:id,:formId,:courseId,:deliveryType,:serviceType,:amountStudent,:language,:roomRental,:roomPc,:roomServices,:instruction,:now,:now)", { replacements: { id: courseRowId, formId: requestFormId, courseId: course.courseId, deliveryType: course.deliveryType, serviceType: course.serviceType, amountStudent: course.amountStudent, language: course.language, roomRental: course.roomRental, roomPc: course.roomPc, roomServices: JSON.stringify(course.roomServices), instruction: course.specialInstruction || null, now }, transaction });
    for (const session of course.sessions) await sequelize.query("INSERT INTO [dbo].[request_form_session] ([id],[request_form_course_id],[requested_date],[start_time],[end_time],[created_at],[updated_at]) VALUES (:id,:courseId,:date,NULL,NULL,:now,:now)", { replacements: { id: randomUUID(), courseId: courseRowId, date: session.date, now }, transaction });
  }
}

function configureCloudinary() {
  if (!env.cloudinaryConfigured) throw new AppError(503, "Request Form attachment storage is not configured");
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });
}

function requestFormDownloadUrl(publicId: string, format: string) {
  configureCloudinary();
  return cloudinary.utils.private_download_url(publicId, format, { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 });
}

async function uploadAttachment(formId: string, input: AttachmentInput) {
  const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!Object.hasOwn(ALLOWED_FILE_TYPES, extension) || input.fileName.length > 255 || input.contentBase64.length > 14_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64)) throw new AppError(400, "Only Word or PDF files no larger than 10 MB are allowed");
  const buffer = Buffer.from(input.contentBase64, "base64");
  if (buffer.byteLength > 10 * 1024 * 1024 || buffer.byteLength === 0 || (extension === "pdf" && !buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))) throw new AppError(400, "Only valid Word or PDF files no larger than 10 MB are allowed");
  configureCloudinary();
  const publicId = `request-forms/${formId}/${randomUUID()}.${extension}`;
  const asset = await new Promise<{ publicId: string; assetId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: "raw", type: "authenticated", access_mode: "authenticated", public_id: publicId, overwrite: false }, (error, result) => {
      if (error || !result) return reject(error ?? new Error("Cloudinary returned no upload result"));
      resolve({ publicId: result.public_id, assetId: result.asset_id });
    });
    stream.end(buffer);
  }).catch((error) => { throw new AppError(502, error instanceof Error ? `Attachment upload failed: ${error.message}` : "Attachment upload failed"); });
  const id = randomUUID(); const now = new Date();
  await sequelize.query("INSERT INTO [dbo].[request_form_attachment] ([id],[request_form_id],[file_name],[file_size],[file_format],[cloudinary_public_id],[cloudinary_asset_id],[created_at],[updated_at]) VALUES (:id,:formId,:fileName,:size,:format,:publicId,:assetId,:now,:now)", { replacements: { id, formId, fileName: input.fileName, size: buffer.byteLength, format: extension, publicId: asset.publicId, assetId: asset.assetId, now } });
  return { id, file_name: input.fileName, file_size: buffer.byteLength, file_format: extension, download_url: requestFormDownloadUrl(asset.publicId, extension) };
}

requestFormsRouter.use(authorizeActiveRole(ROLES.SALES));

requestFormsRouter.get("/options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const formType = req.query.formType ?? "REQUEST";
  if (formType !== "REQUEST" && formType !== "REGISTRATION") throw new AppError(400, "Invalid form type");
  const [accounts, courses, allQuotations] = await Promise.all([
    sequelize.query("SELECT a.[id],a.[account_code],a.[name] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=a.[id] WHERE a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL ORDER BY a.[name]", { replacements: { subject: req.auth!.userId }, type: QueryTypes.SELECT }),
    sequelize.query("SELECT [id],[name],[duration_minutes] FROM [dbo].[course] WHERE [status]='ACTIVE' ORDER BY [name]", { type: QueryTypes.SELECT }),
    sequelize.query<{ id: string; quotation_code: string; class_type: string; account_name: string; pic_name: string }>("SELECT q.[id],q.[quotation_code],q.[class_type],a.[name] AS [account_name],pp.[name] AS [pic_name] FROM [dbo].[quotation] q JOIN [dbo].[account] a ON a.[id]=q.[account_id] AND a.[status]='ACTIVE' AND a.[account_type]='CORPORATE' JOIN [dbo].[pic_profile] pp ON pp.[id]=q.[pic_profile_id] AND pp.[status]='ACTIVE' JOIN [dbo].[pic_account_assignment] pa ON pa.[account_id]=a.[id] AND pa.[pic_profile_id]=pp.[id] AND pa.[ended_at] IS NULL JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=q.[account_id] AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL WHERE q.[created_by_subject]=:subject AND q.[status]='APPROVED' AND q.[deleted_at] IS NULL ORDER BY q.[updated_at] DESC", { replacements: { subject: req.auth!.userId }, type: QueryTypes.SELECT }),
  ]);
  const allowedTypes = formType === "REGISTRATION" ? ["PUBLIC", "ONLINE_PUBLIC"] : ["PRIVATE", "INHOUSE", "ONLINE_PRIVATE"];
  return res.json({ accounts, courses, quotations: allQuotations.filter((quotation) => allowedTypes.includes(quotation.class_type)) });
}));

requestFormsRouter.get("/accounts/:accountId/pics", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const account = await sequelize.query("SELECT TOP (1) a.[id] FROM [dbo].[account] a JOIN [dbo].[sales_account_assignment] sa ON sa.[account_id]=a.[id] WHERE a.[id]=:id AND a.[status]='ACTIVE' AND sa.[sales_subject]=:subject AND sa.[ended_at] IS NULL", { replacements: { id: req.params.accountId, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!account.length) throw new AppError(404, "Account not found");
  const items = await sequelize.query("SELECT pp.[id],pp.[name],pp.[email] FROM [dbo].[pic_profile] pp JOIN [dbo].[pic_account_assignment] pa ON pa.[pic_profile_id]=pp.[id] WHERE pa.[account_id]=:id AND pa.[ended_at] IS NULL AND pp.[status]='ACTIVE' ORDER BY pp.[name]", { replacements: { id: req.params.accountId }, type: QueryTypes.SELECT });
  return res.json({ items });
}));

requestFormsRouter.get("/quotations/:quotationId/preview", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const { quote, lines } = await approvedQuotation(req.params.quotationId, req.auth!.userId);
  const formType = req.query.formType ?? "REQUEST";
  const compatible = formType === "REGISTRATION"
    ? ["PUBLIC", "ONLINE_PUBLIC"].includes(quote.class_type)
    : formType === "REQUEST"
      ? ["PRIVATE", "INHOUSE", "ONLINE_PRIVATE"].includes(quote.class_type)
      : false;
  if (!compatible) throw new AppError(400, "This approved Quotation does not match the selected form menu");
  return res.json({ quote, lines });
}));

requestFormsRouter.get("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000); const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const status = req.query.status ?? "ALL"; const search = req.query.search; const deliveryType = req.query.deliveryType ?? "ALL"; const accountId = req.query.accountId ?? "ALL"; const formType = req.query.formType ?? "REQUEST";
  if (formType !== "REQUEST" && formType !== "REGISTRATION") throw new AppError(400, "Invalid form type");
  if (status !== "ALL" && !["DRAFT", "WAITING", "REVISION", "APPROVED"].includes(String(status))) throw new AppError(400, "Invalid Request Form status");
  if (deliveryType !== "ALL" && !DELIVERY_TYPES.includes(String(deliveryType) as DeliveryType)) throw new AppError(400, "Invalid Request Form class type");
  if (accountId !== "ALL" && !isUuid(accountId)) throw new AppError(400, "Invalid Request Form account");
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) throw new AppError(400, "Invalid search");
  const filters = ["rf.[created_by_subject]=:subject", "rf.[form_type]=:formType"]; const replacements: Record<string, unknown> = { subject: req.auth!.userId, formType, offset: (page - 1) * pageSize, pageSize };
  if (status !== "ALL") { filters.push("rf.[status]=:status"); replacements.status = status; }
  if (deliveryType !== "ALL") { filters.push("EXISTS (SELECT 1 FROM [dbo].[request_form_course] rfc WHERE rfc.[request_form_id]=rf.[id] AND rfc.[delivery_type]=:deliveryType)"); replacements.deliveryType = deliveryType; }
  if (accountId !== "ALL") { filters.push("rf.[account_id]=:accountId"); replacements.accountId = accountId; }
  if (search) { filters.push("(rf.[po_reference] LIKE :search OR q.[quotation_code] LIKE :search OR a.[name] LIKE :search OR EXISTS (SELECT 1 FROM [dbo].[request_form_course] rfc JOIN [dbo].[course] c ON c.[id]=rfc.[course_id] WHERE rfc.[request_form_id]=rf.[id] AND c.[name] LIKE :search))"); replacements.search = escapeLike(search); }
  const where = `WHERE ${filters.join(" AND ")}`;
  const count = await sequelize.query<{ total: number | string }>(`SELECT COUNT_BIG(1) AS [total] FROM [dbo].[request_form] rf JOIN [dbo].[account] a ON a.[id]=rf.[account_id] LEFT JOIN [dbo].[quotation] q ON q.[id]=rf.[quotation_id] ${where}`, { replacements, type: QueryTypes.SELECT });
  const items = await sequelize.query<Record<string, unknown>>(`SELECT rf.[id],rf.[form_type],rf.[quotation_id],rf.[status],rf.[po_reference],rf.[review_note],rf.[created_at],rf.[updated_at],a.[name] AS [account_name],pp.[name] AS [pic_name],q.[quotation_code],(SELECT COUNT(1) FROM [dbo].[request_form_course] rfc WHERE rfc.[request_form_id]=rf.[id]) AS [course_count],(SELECT COUNT(1) FROM [dbo].[request_form_attachment] rfa WHERE rfa.[request_form_id]=rf.[id]) AS [attachment_count],(SELECT STRING_AGG(c.[name], ', ') FROM [dbo].[request_form_course] rfc JOIN [dbo].[course] c ON c.[id]=rfc.[course_id] WHERE rfc.[request_form_id]=rf.[id]) AS [requested_course],(SELECT TOP (1) rfc.[delivery_type] FROM [dbo].[request_form_course] rfc WHERE rfc.[request_form_id]=rf.[id] ORDER BY rfc.[delivery_type]) AS [delivery_type],(SELECT SUM(rfc.[amount_student]) FROM [dbo].[request_form_course] rfc WHERE rfc.[request_form_id]=rf.[id]) AS [students],(SELECT STRING_AGG(CONVERT(char(10), rfs.[requested_date], 23), ',') FROM [dbo].[request_form_course] rfc JOIN [dbo].[request_form_session] rfs ON rfs.[request_form_course_id]=rfc.[id] WHERE rfc.[request_form_id]=rf.[id]) AS [requested_dates] FROM [dbo].[request_form] rf JOIN [dbo].[account] a ON a.[id]=rf.[account_id] JOIN [dbo].[pic_profile] pp ON pp.[id]=rf.[pic_profile_id] LEFT JOIN [dbo].[quotation] q ON q.[id]=rf.[quotation_id] ${where} ORDER BY rf.[updated_at] DESC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY`, { replacements, type: QueryTypes.SELECT });
  return res.json({ items, page, pageSize, total: Number(count[0]?.total ?? 0) });
}));

requestFormsRouter.get("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => res.json(await readForm(req.params.id, req.auth!.userId))));

requestFormsRouter.post("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); let accountId = input.accountId; let picId = input.picId; let courseInputs = input.courses;
  if (input.quotationId) {
    const { quote, lines } = await approvedQuotation(input.quotationId, req.auth!.userId);
    const actualType = quote.class_type === "PUBLIC" || quote.class_type === "ONLINE_PUBLIC" ? "REGISTRATION" : "REQUEST";
    if (input.formType !== actualType) throw new AppError(400, "The selected Quotation belongs to a different form type");
    const deliveryType = quote.class_type as DeliveryType;
    accountId = quote.account_id; picId = quote.pic_profile_id;
    courseInputs = lines.filter((line) => input.courses.some((course) => course.courseId === line.course_id)).map((line) => {
      const provided = input.courses.find((course) => course.courseId === line.course_id);
      return { courseId: line.course_id, amountStudent: Number(line.amount_student), deliveryType, serviceType: provided?.serviceType ?? "STANDARD", language: provided?.language ?? "Indonesia", roomRental: provided?.roomRental ?? null, roomPc: provided?.roomPc ?? null, roomServices: provided?.roomServices ?? [], specialInstruction: provided?.specialInstruction ?? "", sessions: provided?.sessions ?? [] };
    });
    if (input.courses.some((course) => !lines.some((line) => line.course_id === course.courseId))) throw new AppError(400, "Request Form Courses must come from the selected Approved Quotation");
  } else {
    await validateAccountAndPic(accountId, picId, req.auth!.userId);
    const allowed = input.formType === "REGISTRATION" ? ["PUBLIC", "ONLINE_PUBLIC"] : ["PRIVATE", "INHOUSE", "ONLINE_PRIVATE"];
    if (courseInputs.some((course) => !allowed.includes(course.deliveryType))) throw new AppError(400, "Course type does not match the selected Request/Registration Form menu");
  }
  await validateCourses(courseInputs);
  const trainingTitle = await deriveTrainingTitle(courseInputs);
  const id = randomUUID(); const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("INSERT INTO [dbo].[request_form] ([id],[form_type],[quotation_id],[created_by_subject],[reviewed_by_subject],[attachment_file],[training_title],[request_date],[language],[training_type],[number_student],[room_rental],[special_instruction],[approved_at],[account_id],[pic_profile_id],[status],[po_reference],[review_note],[created_at],[updated_at]) VALUES (:id,:formType,:quotationId,:subject,NULL,NULL,:trainingTitle,NULL,NULL,NULL,NULL,0,NULL,NULL,:accountId,:picId,'DRAFT',:poReference,NULL,:now,:now)", { replacements: { id, formType: input.formType, quotationId: input.quotationId, subject: req.auth!.userId, accountId, picId, trainingTitle, poReference: input.poReference || null, now }, transaction });
    await saveCourses(id, courseInputs, transaction);
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "REQUEST_FORM", objectId: id, after: { status: "DRAFT", quotation_id: input.quotationId, account_id: accountId, pic_profile_id: picId, course_count: courseInputs.length }, processName: "request-form-create" }, transaction);
  });
  return res.status(201).json(await readForm(id, req.auth!.userId));
}));

requestFormsRouter.put("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); const oldRows = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [created_by_subject]=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  const old = oldRows[0]; if (!old) throw new AppError(404, "Request Form not found");
  if (old.status !== "DRAFT" && old.status !== "REVISION") throw new AppError(409, "Only a Draft or returned Revision Request Form can be edited");
  if (input.formType !== (old as RequestFormRow & { form_type: string }).form_type) throw new AppError(400, "Form type cannot be changed");
  let accountId = input.accountId; let picId = input.picId; let courseInputs = input.courses;
  if (old.quotation_id) {
    if (input.quotationId !== old.quotation_id) throw new AppError(400, "The source Approved Quotation cannot be changed");
    const { quote, lines } = await approvedQuotation(old.quotation_id, req.auth!.userId);
    if (input.courses.some((course) => !lines.some((row) => row.course_id === course.courseId))) throw new AppError(400, "Only Courses included in the source Approved Quotation can be selected");
    accountId = old.account_id; picId = old.pic_profile_id;
    courseInputs = input.courses.map((course) => { const original = lines.find((row) => row.course_id === course.courseId)!; return { ...course, amountStudent: Number(original.amount_student), deliveryType: quote.class_type as DeliveryType }; });
  } else {
    await validateAccountAndPic(accountId, picId, req.auth!.userId);
    const allowed = input.formType === "REGISTRATION" ? ["PUBLIC", "ONLINE_PUBLIC"] : ["PRIVATE", "INHOUSE", "ONLINE_PRIVATE"];
    if (courseInputs.some((course) => !allowed.includes(course.deliveryType))) throw new AppError(400, "Course type does not match the selected Request/Registration Form menu");
  }
  await validateCourses(courseInputs, Boolean(old.quotation_id));
  const trainingTitle = await deriveTrainingTitle(courseInputs);
  const transaction = await sequelize.transaction();
  try {
    await sequelize.query("DELETE FROM [dbo].[request_form_course] WHERE [request_form_id]=:id", { replacements: { id: old.id }, transaction });
    await saveCourses(old.id, courseInputs, transaction);
    await sequelize.query("UPDATE [dbo].[request_form] SET [quotation_id]=:quotationId,[account_id]=:accountId,[pic_profile_id]=:picId,[po_reference]=:poReference,[training_title]=:trainingTitle,[updated_at]=:now WHERE [id]=:id", { replacements: { id: old.id, quotationId: old.quotation_id, accountId, picId, poReference: input.poReference || null, trainingTitle, now: new Date() }, transaction });
    const before: Record<string, unknown> = {}; const after: Record<string, unknown> = {};
    if ((old.po_reference ?? null) !== (input.poReference || null)) { before.po_reference = old.po_reference; after.po_reference = input.poReference || null; }
    if (Object.keys(before).length) await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: old.id, before, after, processName: "request-form-edit" }, transaction);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  return res.json(await readForm(old.id, req.auth!.userId));
}));

requestFormsRouter.post("/:id/attachments", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [created_by_subject]=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Request Form not found");
  if (rows[0].status !== "DRAFT" && rows[0].status !== "REVISION") throw new AppError(409, "Attachments can only be changed on Draft or Revision Request Forms");
  const file = req.body as AttachmentInput;
  if (!file || typeof file.fileName !== "string" || typeof file.contentBase64 !== "string") throw new AppError(400, "Choose a Word or PDF attachment");
  return res.status(201).json({ item: await uploadAttachment(rows[0].id, file) });
}));

requestFormsRouter.delete("/:id/attachments/:attachmentId", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const form = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [created_by_subject]=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!form[0]) throw new AppError(404, "Request Form not found");
  if (form[0].status !== "DRAFT" && form[0].status !== "REVISION") throw new AppError(409, "Attachments can only be changed on Draft or Revision Request Forms");
  const rows = await sequelize.query<{ cloudinary_public_id: string; file_format: string }>("DELETE FROM [dbo].[request_form_attachment] OUTPUT DELETED.[cloudinary_public_id],DELETED.[file_format] WHERE [id]=:attachmentId AND [request_form_id]=:id", { replacements: { attachmentId: req.params.attachmentId, id: req.params.id }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Attachment not found");
  configureCloudinary(); await cloudinary.uploader.destroy(rows[0].cloudinary_public_id, { resource_type: "raw", type: "authenticated" }).catch(() => undefined);
  return res.status(204).end();
}));

requestFormsRouter.get("/:id/attachments/:attachmentId", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<{ cloudinary_public_id: string; file_format: string }>("SELECT a.[cloudinary_public_id],a.[file_format] FROM [dbo].[request_form_attachment] a JOIN [dbo].[request_form] rf ON rf.[id]=a.[request_form_id] WHERE rf.[id]=:id AND rf.[created_by_subject]=:subject AND a.[id]=:attachmentId", { replacements: { id: req.params.id, attachmentId: req.params.attachmentId, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Attachment not found");
  return res.json({ url: requestFormDownloadUrl(rows[0].cloudinary_public_id, rows[0].file_format), expiresInSeconds: 300 });
}));

requestFormsRouter.post("/:id/submit", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const detail = await readForm(req.params.id, req.auth!.userId); const item = detail.item as RequestFormRow;
  if (item.status !== "DRAFT" && item.status !== "REVISION") throw new AppError(409, "Only a Draft or returned Revision Request Form can be submitted");
  if (!detail.attachments.length) throw new AppError(400, "Upload at least one RF Attachment before submitting to Admin (QPD)");
  if (!detail.courses.length || detail.courses.some((course) => !(course.sessions as unknown[]).length)) throw new AppError(400, "Add at least one scheduled session for every Course before submitting");
  const before = item.status; const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("UPDATE [dbo].[request_form] SET [status]='WAITING',[review_note]=NULL,[reviewed_by_subject]=NULL,[updated_at]=:now WHERE [id]=:id", { replacements: { id: item.id, now }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: item.id, before: { status: before }, after: { status: "WAITING" }, processName: "request-form-submit" }, transaction);
  });
  return res.json({ item: { id: item.id, status: "WAITING" } });
}));

requestFormsRouter.post("/:id/withdraw", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const rows = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [created_by_subject]=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT, transaction });
    const form = rows[0];
    if (!form) throw new AppError(404, "Request Form not found");
    if (form.status !== "WAITING") throw new AppError(409, "Only a Waiting Request Form can be withdrawn");
    const updated = await sequelize.query<{ id: string }>("UPDATE [dbo].[request_form] SET [status]='DRAFT',[review_note]=NULL,[reviewed_by_subject]=NULL,[updated_at]=:now OUTPUT INSERTED.[id] WHERE [id]=:id AND [created_by_subject]=:subject AND [status]='WAITING'", { replacements: { id: form.id, subject: req.auth!.userId, now: new Date() }, type: QueryTypes.SELECT, transaction });
    if (!updated.length) throw new AppError(409, "The Request Form has already been processed by Admin");
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: "WAITING" }, after: { status: "DRAFT" }, processName: "request-form-withdraw" }, transaction);
    await transaction.commit();
    return res.json({ item: { id: form.id, status: "DRAFT" } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

requestFormsRouter.delete("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [created_by_subject]=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  const form = rows[0]; if (!form) throw new AppError(404, "Request Form not found");
  if (form.status !== "DRAFT") throw new AppError(409, "Only a Draft Request Form can be deleted");
  const attachments = await sequelize.query<{ cloudinary_public_id: string }>("SELECT [cloudinary_public_id] FROM [dbo].[request_form_attachment] WHERE [request_form_id]=:id", { replacements: { id: form.id }, type: QueryTypes.SELECT });
  await sequelize.transaction(async (transaction) => {
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: form.status, account_id: form.account_id, quotation_id: form.quotation_id }, processName: "request-form-delete-draft" }, transaction);
    await sequelize.query("DELETE FROM [dbo].[request_form] WHERE [id]=:id", { replacements: { id: form.id }, transaction });
  });
  if (attachments.length && env.cloudinaryConfigured) { configureCloudinary(); await Promise.all(attachments.map((asset) => cloudinary.uploader.destroy(asset.cloudinary_public_id, { resource_type: "raw", type: "authenticated" }).catch(() => undefined))); }
  return res.status(204).end();
}));

requestFormReviewRouter.use(authorizeActiveRole(ROLES.ADMIN));
requestFormReviewRouter.get("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000); const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const rows = await sequelize.query<Record<string, unknown>>("SELECT rf.[id],rf.[form_type],rf.[status],rf.[po_reference],rf.[review_note],rf.[created_at],rf.[updated_at],a.[name] AS [account_name],pp.[name] AS [pic_name],q.[quotation_code],(SELECT COUNT(1) FROM [dbo].[request_form_course] c WHERE c.[request_form_id]=rf.[id]) AS [course_count] FROM [dbo].[request_form] rf JOIN [dbo].[account] a ON a.[id]=rf.[account_id] JOIN [dbo].[pic_profile] pp ON pp.[id]=rf.[pic_profile_id] LEFT JOIN [dbo].[quotation] q ON q.[id]=rf.[quotation_id] WHERE rf.[status]='WAITING' ORDER BY rf.[updated_at] ASC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY", { replacements: { offset: (page - 1) * pageSize, pageSize }, type: QueryTypes.SELECT });
  const count = await sequelize.query<{ total: number | string }>("SELECT COUNT_BIG(1) AS [total] FROM [dbo].[request_form] WHERE [status]='WAITING'", { type: QueryTypes.SELECT });
  return res.json({ items: rows, page, pageSize, total: Number(count[0]?.total ?? 0) });
}));
requestFormReviewRouter.get("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => res.json(await readForm(req.params.id))));
requestFormReviewRouter.patch("/:id/approve", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [status]='WAITING'", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  const form = rows[0];
  if (!form) throw new AppError(404, "Waiting Request Form not found");
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("UPDATE [dbo].[request_form] SET [status]='APPROVED',[review_note]=NULL,[reviewed_by_subject]=:subject,[approved_at]=:now,[updated_at]=:now WHERE [id]=:id", { replacements: { id: form.id, subject: req.auth!.userId, now: new Date() }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: "WAITING" }, after: { status: "APPROVED" }, processName: "request-form-approve" }, transaction);
  });
  return res.json({ item: { id: form.id, status: "APPROVED" } });
}));
requestFormReviewRouter.patch("/:id/return", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  if (typeof req.body?.note !== "string" || !req.body.note.trim() || req.body.note.length > 4000) throw new AppError(400, "A revision note is required");
  const rows = await sequelize.query<RequestFormRow>("SELECT TOP (1) * FROM [dbo].[request_form] WHERE [id]=:id AND [status]='WAITING'", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  const form = rows[0]; if (!form) throw new AppError(404, "Waiting Request Form not found");
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("UPDATE [dbo].[request_form] SET [status]='REVISION',[review_note]=:note,[reviewed_by_subject]=:subject,[updated_at]=:now WHERE [id]=:id", { replacements: { id: form.id, note: req.body.note.trim(), subject: req.auth!.userId, now: new Date() }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: "WAITING", review_note: form.review_note }, after: { status: "REVISION", review_note: req.body.note.trim() }, processName: "request-form-return-for-revision" }, transaction);
  });
  return res.json({ item: { id: form.id, status: "REVISION", review_note: req.body.note.trim() } });
}));
