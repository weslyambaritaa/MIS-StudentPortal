import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { QueryTypes, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { RequestForm } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import Joi from "joi";
import { validateBody } from "../../utils/joi-validation";

export const requestFormsRouter = Router();
export const requestFormReviewRouter = Router();

const DELIVERY_TYPES = ["PUBLIC", "PRIVATE", "INHOUSE", "ONLINE_PUBLIC", "ONLINE_PRIVATE"] as const;
const SERVICE_TYPES = ["STANDARD", "CUSTOMIZED", "CEO"] as const;
const ROOM_SERVICES = ["INTERNET", "LAN", "SNACKS", "LUNCH"] as const;
const ALLOWED_FILE_TYPES: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
type DeliveryType = typeof DELIVERY_TYPES[number];
type ServiceType = typeof SERVICE_TYPES[number];
type SessionInput = { date: string };
type CourseInput = { courseId: string; amountStudent: number; deliveryType: DeliveryType; serviceType: ServiceType; language: string; roomRental: boolean | null; roomPc: "WITH" | "WITHOUT" | null; roomServices: typeof ROOM_SERVICES[number][]; locationType: "INTERNAL" | "CLIENT" | "ONLINE"; locationName: string; locationAddress: string; specialInstruction: string; sessions: SessionInput[] };
type AttachmentInput = { fileName: string; contentBase64: string };
type FormInput = { formType: "REQUEST" | "REGISTRATION"; quotationId: string | null; accountId: string; picId: string; poReference: string; trainingTitle: string; courses: CourseInput[] };
type QuoteLine = { course_id: string; amount_student: number; class_type: DeliveryType; course_name: string; duration_minutes: number };
type RequestFormRow = { id: string; request_form_number: string; quotation_id: string | null; account_id: string; pic_profile_id: string; created_by_subject: string; status: "DRAFT" | "WAITING" | "REVISION" | "APPROVED"; review_note: string | null; po_reference: string | null; training_title: string | null; training_id?: string | null; account_name?: string; pic_name?: string; quotation_code?: string; created_at: Date; updated_at: Date };
type RequestFormCourseRow = Record<string, unknown> & { id: string; course_id: string; delivery_type: DeliveryType; amount_student: number; location_type: "INTERNAL" | "CLIENT" | "ONLINE"; room_services: string; };

const pageNumber = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;
const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

async function nextRequestFormNumber(transaction: Transaction) {
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
  const rows = await sequelize.query<{ last_number: number | string }>(
    "INSERT INTO request_form_number_sequence (number_year,last_number) VALUES (:year,1) ON CONFLICT (number_year) DO UPDATE SET last_number=request_form_number_sequence.last_number+1 RETURNING last_number",
    { replacements: { year }, type: QueryTypes.SELECT, transaction },
  );
  return `RF-${year}-${String(Number(rows[0].last_number)).padStart(4, "0")}`;
}

function parseInput(body: unknown): FormInput {
  const raw = validateBody<Record<string, unknown>>(Joi.object({
    formType: Joi.string().valid("REQUEST", "REGISTRATION").optional(),
    quotationId: Joi.alternatives().try(Joi.string().guid({ version: ["uuidv4", "uuidv5"] }), Joi.valid(null, "")).optional(),
    accountId: Joi.alternatives().try(Joi.string().guid({ version: ["uuidv4", "uuidv5"] }), Joi.valid("")).optional(),
    picId: Joi.alternatives().try(Joi.string().guid({ version: ["uuidv4", "uuidv5"] }), Joi.valid("")).optional(),
    poReference: Joi.string().max(150).optional(),
    trainingTitle: Joi.string().max(255).optional(),
    courses: Joi.array().length(1).items(Joi.object({
      courseId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
      amountStudent: Joi.number().integer().min(1).max(100000).required(),
      deliveryType: Joi.string().valid(...DELIVERY_TYPES).required(),
      serviceType: Joi.string().valid(...SERVICE_TYPES).required(),
      language: Joi.string().trim().min(1).max(50).required(),
      roomRental: Joi.boolean().allow(null).required(),
      roomPc: Joi.string().valid("WITH", "WITHOUT").allow(null).required(),
      roomServices: Joi.array().items(Joi.string().valid(...ROOM_SERVICES)).required(),
      locationType: Joi.string().valid("INTERNAL", "CLIENT", "ONLINE").required(),
      locationName: Joi.string().allow("").max(150).required(),
      locationAddress: Joi.string().allow("").max(500).required(),
      specialInstruction: Joi.string().max(4000).optional(),
      sessions: Joi.array().max(100).items(Joi.object({ date: Joi.string().pattern(/^(?:\d{4}-\d{2}-\d{2})?$/).required() }).unknown(false)).required(),
    }).unknown(false)).required(),
  }).unknown(false), body);
  const formType = raw.formType === "REGISTRATION" ? "REGISTRATION" : raw.formType === "REQUEST" || raw.formType === undefined ? "REQUEST" : null;
  if (!formType) throw new AppError(400, "Invalid form type");
  const quotationId = raw.quotationId === null || raw.quotationId === undefined || raw.quotationId === "" ? null : raw.quotationId;
  if (quotationId !== null && !isUuid(quotationId)) throw new AppError(400, "Select a valid approved Quotation");
  if ((!quotationId && (!isUuid(raw.accountId) || !isUuid(raw.picId))) || (quotationId && ((raw.accountId !== undefined && raw.accountId !== "" && !isUuid(raw.accountId)) || (raw.picId !== undefined && raw.picId !== "" && !isUuid(raw.picId)))) || !Array.isArray(raw.courses) || raw.courses.length !== 1) throw new AppError(400, "Select an Account, PIC, and exactly one Course");
  if (raw.poReference !== undefined && (typeof raw.poReference !== "string" || raw.poReference.length > 150)) throw new AppError(400, "PO/SPK reference must be 150 characters or fewer");
  const courses = raw.courses.map((entry): CourseInput => {
    if (!entry || typeof entry !== "object") throw new AppError(400, "Invalid Course detail");
    const course = entry as Record<string, unknown>;
    if (!isUuid(course.courseId) || !Number.isSafeInteger(course.amountStudent) || Number(course.amountStudent) < 1 || !DELIVERY_TYPES.includes(course.deliveryType as DeliveryType) || !SERVICE_TYPES.includes(course.serviceType as ServiceType) || typeof course.language !== "string" || !course.language.trim() || course.language.length > 50 || (course.roomRental !== null && typeof course.roomRental !== "boolean") || (course.roomPc !== null && course.roomPc !== "WITH" && course.roomPc !== "WITHOUT") || (course.roomRental && course.roomPc === null) || !Array.isArray(course.roomServices) || course.roomServices.some((service) => !ROOM_SERVICES.includes(service as typeof ROOM_SERVICES[number])) || !["INTERNAL", "CLIENT", "ONLINE"].includes(String(course.locationType)) || typeof course.locationName !== "string" || course.locationName.length > 150 || typeof course.locationAddress !== "string" || course.locationAddress.length > 500 || (course.deliveryType === "ONLINE_PUBLIC" || course.deliveryType === "ONLINE_PRIVATE" ? course.locationType !== "ONLINE" : course.locationType === "ONLINE") || (course.deliveryType === "INHOUSE" && course.locationType !== "CLIENT") || (course.locationType === "CLIENT" && !course.locationName.trim() && !course.locationAddress.trim()) || (course.specialInstruction !== undefined && (typeof course.specialInstruction !== "string" || course.specialInstruction.length > 4000)) || !Array.isArray(course.sessions) || course.sessions.length > 100) throw new AppError(400, "Enter valid Course details, location, class options, and session schedule");
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
    return { courseId: course.courseId, amountStudent: Number(course.amountStudent), deliveryType: course.deliveryType as DeliveryType, serviceType: course.serviceType as ServiceType, language: course.language.trim(), roomRental, roomPc: roomRental === true ? course.roomPc as "WITH" | "WITHOUT" | null : null, roomServices: roomRental === true ? roomServices : [], locationType: course.locationType as CourseInput["locationType"], locationName: course.locationName.trim(), locationAddress: course.locationAddress.trim(), specialInstruction: typeof course.specialInstruction === "string" ? course.specialInstruction.trim() : "", sessions };
  });
  if (new Set(courses.map((course) => course.courseId)).size !== courses.length) throw new AppError(400, "A Course may only be added once to a Request Form");
  return { formType, quotationId: quotationId as string | null, accountId: typeof raw.accountId === "string" ? raw.accountId : "", picId: typeof raw.picId === "string" ? raw.picId : "", poReference: typeof raw.poReference === "string" ? raw.poReference.trim() : "", trainingTitle: typeof raw.trainingTitle === "string" ? raw.trainingTitle.trim() : "", courses };
}

async function deriveTrainingTitle(courses: CourseInput[]) {
  const rows = await sequelize.query<{ id: string; name: string }>("SELECT id,name FROM course WHERE id IN (:ids)", { replacements: { ids: courses.map((course) => course.courseId) }, type: QueryTypes.SELECT });
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const title = courses.map((course) => names.get(course.courseId)).filter(Boolean).join(" + ");
  if (!title || title.length > 255) throw new AppError(400, "Could not create a Training Title from the selected Courses");
  return title;
}

async function validateAccountAndPic(accountId: string, picId: string, salesSubject: string) {
  const rows = await sequelize.query("SELECT a.id AS account_id,pp.id AS pic_id FROM account a JOIN sales_account_assignment sa ON sa.account_id=a.id JOIN pic_account_assignment pa ON pa.account_id=a.id AND pa.ended_at IS NULL JOIN pic_profile pp ON pp.id=pa.pic_profile_id WHERE a.id=:accountId AND a.status='ACTIVE' AND a.account_type='CORPORATE' AND sa.sales_subject=:subject AND sa.ended_at IS NULL AND pp.id=:picId AND pp.status='ACTIVE' LIMIT 1", { replacements: { accountId, picId, subject: salesSubject }, type: QueryTypes.SELECT });
  if (!rows.length) throw new AppError(400, "Choose an active Account assigned to you and an active PIC belonging to that Account");
}

async function approvedQuotation(quotationId: string, salesSubject: string) {
  const rows = await sequelize.query<RequestFormRow & { class_type: string; account_name: string; pic_name: string; pic_email: string }>("SELECT q.id,q.account_id,q.pic_profile_id,q.created_by_subject,q.status,q.quotation_code,q.class_type,a.name AS account_name,pp.name AS pic_name,pp.email AS pic_email FROM quotation q JOIN sales_account_assignment sa ON sa.account_id=q.account_id AND sa.sales_subject=:subject AND sa.ended_at IS NULL JOIN account a ON a.id=q.account_id AND a.status='ACTIVE' AND a.account_type='CORPORATE' JOIN pic_profile pp ON pp.id=q.pic_profile_id AND pp.status='ACTIVE' JOIN pic_account_assignment pa ON pa.pic_profile_id=pp.id AND pa.account_id=a.id AND pa.ended_at IS NULL WHERE q.id=:id AND q.created_by_subject=:subject AND q.status='APPROVED' AND q.deleted_at IS NULL LIMIT 1", { replacements: { id: quotationId, subject: salesSubject }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(400, "Only an active Approved Quotation assigned to you can be selected");
  const lines = await sequelize.query<QuoteLine>("SELECT qo.course_id,qo.amount_student,qo.class_type,c.name AS course_name,c.duration_minutes FROM quotation_order qo JOIN course c ON c.id=qo.course_id WHERE qo.quotation_id=:id", { replacements: { id: quotationId }, type: QueryTypes.SELECT });
  if (!lines.length) throw new AppError(409, "The approved Quotation has no Course details");
  return { quote: rows[0], lines };
}

async function validateCourses(courses: CourseInput[], allowInactive = false) {
  const rows = await sequelize.query<{ id: string }>(`SELECT id FROM course WHERE ${allowInactive ? "1=1 AND" : "status='ACTIVE' AND"} id IN (:ids)`, { replacements: { ids: courses.map((course) => course.courseId) }, type: QueryTypes.SELECT });
  if (rows.length !== courses.length) throw new AppError(400, "One or more Courses are inactive or unavailable");
}

async function readForm(id: string, subject?: string) {
  const whereOwner = subject ? "AND rf.created_by_subject=:subject" : "";
  const rows = await sequelize.query<RequestFormRow & { account_name: string; industry_name: string | null; pic_name: string; pic_email: string; quotation_code: string | null }>(
    `SELECT rf.*,a.name AS account_name,i.name AS industry_name,pp.name AS pic_name,pp.email AS pic_email,q.quotation_code,q.class_type AS quotation_class_type,(SELECT t.id FROM training t WHERE t.request_form_id=rf.id ORDER BY t.created_at DESC LIMIT 1) AS training_id
       FROM request_form rf LEFT JOIN account a ON a.id=rf.account_id LEFT JOIN industry i ON i.id=a.industry_id LEFT JOIN pic_profile pp ON pp.id=rf.pic_profile_id
       LEFT JOIN quotation q ON q.id=rf.quotation_id WHERE rf.id=:id ${whereOwner}`,
    { replacements: { id, ...(subject ? { subject } : {}) }, type: QueryTypes.SELECT },
  );
  if (!rows[0]) throw new AppError(404, "Request Form not found");
  const courses = await sequelize.query<RequestFormCourseRow>("SELECT rfc.*,c.name AS course_name,c.duration_minutes FROM request_form_course rfc JOIN course c ON c.id=rfc.course_id WHERE rfc.request_form_id=:id ORDER BY c.name", { replacements: { id }, type: QueryTypes.SELECT });
  const attachments = await sequelize.query<Record<string, unknown>>("SELECT id,file_name,file_size,file_format,cloudinary_public_id,created_at FROM request_form_attachment WHERE request_form_id=:id ORDER BY created_at", { replacements: { id }, type: QueryTypes.SELECT });
  const courseIds = courses.map((course) => String(course.id));
  const sessions = courseIds.length ? await sequelize.query<Record<string, unknown>>("SELECT * FROM request_form_session WHERE request_form_course_id IN (:ids) ORDER BY requested_date", { replacements: { ids: courseIds }, type: QueryTypes.SELECT }) : [];
  const withSessions = courses.map((course) => ({ ...course, room_services: JSON.parse(String(course.room_services || "[]")) as string[], sessions: sessions.filter((session) => session.request_form_course_id === course.id).map((session) => ({ id: session.id, date: session.requested_date })) }));
  return { item: rows[0], courses: withSessions, attachments: attachments.map(({ cloudinary_public_id: publicId, ...attachment }) => ({ ...attachment, download_url: requestFormDownloadUrl(String(publicId), String(attachment.file_format)) })) };
}

async function saveCourses(requestFormId: string, courses: CourseInput[], transaction: Transaction) {
  for (const course of courses) {
    const courseRowId = randomUUID(); const now = new Date();
    await sequelize.query("INSERT INTO request_form_course (id,request_form_id,course_id,delivery_type,service_type,amount_student,language,room_rental,room_pc,room_services,location_type,location_name,location_address,special_instruction,created_at,updated_at) VALUES (:id,:formId,:courseId,:deliveryType,:serviceType,:amountStudent,:language,:roomRental,:roomPc,:roomServices,:locationType,:locationName,:locationAddress,:instruction,:now,:now)", { replacements: { id: courseRowId, formId: requestFormId, courseId: course.courseId, deliveryType: course.deliveryType, serviceType: course.serviceType, amountStudent: course.amountStudent, language: course.language, roomRental: course.roomRental, roomPc: course.roomPc, roomServices: JSON.stringify(course.roomServices), locationType: course.locationType, locationName: course.locationType === "CLIENT" ? course.locationName : null, locationAddress: course.locationType === "CLIENT" ? course.locationAddress : null, instruction: course.specialInstruction || null, now }, transaction });
    for (const session of course.sessions) await sequelize.query("INSERT INTO request_form_session (id,request_form_course_id,requested_date,start_time,end_time,created_at,updated_at) VALUES (:id,:courseId,:date,NULL,NULL,:now,:now)", { replacements: { id: randomUUID(), courseId: courseRowId, date: session.date, now }, transaction });
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
  await sequelize.query("INSERT INTO request_form_attachment (id,request_form_id,file_name,file_size,file_format,cloudinary_public_id,cloudinary_asset_id,created_at,updated_at) VALUES (:id,:formId,:fileName,:size,:format,:publicId,:assetId,:now,:now)", { replacements: { id, formId, fileName: input.fileName, size: buffer.byteLength, format: extension, publicId: asset.publicId, assetId: asset.assetId, now } });
  return { id, file_name: input.fileName, file_size: buffer.byteLength, file_format: extension, download_url: requestFormDownloadUrl(asset.publicId, extension) };
}

requestFormsRouter.use(authorizeActiveRole(ROLES.SALES));

requestFormsRouter.get("/options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const formType = req.query.formType ?? "REQUEST";
  if (formType !== "REQUEST" && formType !== "REGISTRATION") throw new AppError(400, "Invalid form type");
  const [accounts, courses, allQuotations] = await Promise.all([
    sequelize.query("SELECT a.id,a.account_code,a.name FROM account a JOIN sales_account_assignment sa ON sa.account_id=a.id WHERE a.status='ACTIVE' AND a.account_type='CORPORATE' AND sa.sales_subject=:subject AND sa.ended_at IS NULL ORDER BY a.name", { replacements: { subject: req.auth!.userId }, type: QueryTypes.SELECT }),
    sequelize.query("SELECT id,name,duration_minutes FROM course WHERE status='ACTIVE' ORDER BY name", { type: QueryTypes.SELECT }),
    sequelize.query<{ id: string; quotation_code: string; class_type: string; account_name: string; pic_name: string }>("SELECT q.id,q.quotation_code,q.class_type,a.name AS account_name,pp.name AS pic_name FROM quotation q JOIN account a ON a.id=q.account_id AND a.status='ACTIVE' AND a.account_type='CORPORATE' JOIN pic_profile pp ON pp.id=q.pic_profile_id AND pp.status='ACTIVE' JOIN pic_account_assignment pa ON pa.account_id=a.id AND pa.pic_profile_id=pp.id AND pa.ended_at IS NULL JOIN sales_account_assignment sa ON sa.account_id=q.account_id AND sa.sales_subject=:subject AND sa.ended_at IS NULL WHERE q.created_by_subject=:subject AND q.status='APPROVED' AND q.deleted_at IS NULL ORDER BY q.updated_at DESC", { replacements: { subject: req.auth!.userId }, type: QueryTypes.SELECT }),
  ]);
  const allowedTypes = formType === "REGISTRATION" ? ["PUBLIC", "ONLINE_PUBLIC"] : ["PRIVATE", "INHOUSE", "ONLINE_PRIVATE"];
  return res.json({ accounts, courses, quotations: allQuotations.filter((quotation) => allowedTypes.includes(quotation.class_type)) });
}));

requestFormsRouter.get("/accounts/:accountId/pics", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const account = await sequelize.query("SELECT a.id FROM account a JOIN sales_account_assignment sa ON sa.account_id=a.id WHERE a.id=:id AND a.status='ACTIVE' AND sa.sales_subject=:subject AND sa.ended_at IS NULL", { replacements: { id: req.params.accountId, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!account.length) throw new AppError(404, "Account not found");
  const items = await sequelize.query("SELECT pp.id,pp.name,pp.email FROM pic_profile pp JOIN pic_account_assignment pa ON pa.pic_profile_id=pp.id WHERE pa.account_id=:id AND pa.ended_at IS NULL AND pp.status='ACTIVE' ORDER BY pp.name", { replacements: { id: req.params.accountId }, type: QueryTypes.SELECT });
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
  const filters = ["rf.created_by_subject=:subject", "rf.form_type=:formType"]; const replacements: Record<string, unknown> = { subject: req.auth!.userId, formType, offset: (page - 1) * pageSize, pageSize };
  if (status !== "ALL") { filters.push("rf.status=:status"); replacements.status = status; }
  if (deliveryType !== "ALL") { filters.push("EXISTS (SELECT 1 FROM request_form_course rfc WHERE rfc.request_form_id=rf.id AND rfc.delivery_type=:deliveryType)"); replacements.deliveryType = deliveryType; }
  if (accountId !== "ALL") { filters.push("rf.account_id=:accountId"); replacements.accountId = accountId; }
  if (search) { filters.push("(rf.po_reference ILIKE :search ESCAPE E'\\\\' OR q.quotation_code ILIKE :search ESCAPE E'\\\\' OR a.name ILIKE :search ESCAPE E'\\\\' OR EXISTS (SELECT 1 FROM request_form_course rfc JOIN course c ON c.id=rfc.course_id WHERE rfc.request_form_id=rf.id AND c.name ILIKE :search ESCAPE E'\\\\'))"); replacements.search = escapeLike(search); }
  const where = `WHERE ${filters.join(" AND ")}`;
  const count = await sequelize.query<{ total: number | string }>(`SELECT COUNT(1) AS total FROM request_form rf JOIN account a ON a.id=rf.account_id LEFT JOIN quotation q ON q.id=rf.quotation_id ${where}`, { replacements, type: QueryTypes.SELECT });
  const items = await sequelize.query<Record<string, unknown>>(`SELECT rf.id,rf.request_form_number,rf.form_type,rf.quotation_id,rf.status,rf.po_reference,rf.review_note,rf.created_at,rf.updated_at,a.name AS account_name,pp.name AS pic_name,q.quotation_code,(SELECT t.id FROM training t WHERE t.request_form_id=rf.id ORDER BY t.created_at DESC LIMIT 1) AS training_id,(SELECT COUNT(1) FROM request_form_course rfc WHERE rfc.request_form_id=rf.id) AS course_count,(SELECT COUNT(1) FROM request_form_attachment rfa WHERE rfa.request_form_id=rf.id) AS attachment_count,(SELECT STRING_AGG(c.name, ', ') FROM request_form_course rfc JOIN course c ON c.id=rfc.course_id WHERE rfc.request_form_id=rf.id) AS requested_course,(SELECT rfc.delivery_type FROM request_form_course rfc WHERE rfc.request_form_id=rf.id ORDER BY rfc.delivery_type LIMIT 1) AS delivery_type,(SELECT SUM(rfc.amount_student) FROM request_form_course rfc WHERE rfc.request_form_id=rf.id) AS students,(SELECT STRING_AGG(TO_CHAR(rfs.requested_date,'YYYY-MM-DD'), ',') FROM request_form_course rfc JOIN request_form_session rfs ON rfs.request_form_course_id=rfc.id WHERE rfc.request_form_id=rf.id) AS requested_dates FROM request_form rf JOIN account a ON a.id=rf.account_id JOIN pic_profile pp ON pp.id=rf.pic_profile_id LEFT JOIN quotation q ON q.id=rf.quotation_id ${where} ORDER BY rf.updated_at DESC LIMIT :pageSize OFFSET :offset`, { replacements, type: QueryTypes.SELECT });
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
      const isOnline = deliveryType === "ONLINE_PUBLIC" || deliveryType === "ONLINE_PRIVATE";
      const locationType = isOnline ? "ONLINE" : deliveryType === "INHOUSE" ? "CLIENT" : provided?.locationType ?? "INTERNAL";
      return { courseId: line.course_id, amountStudent: Number(line.amount_student), deliveryType, serviceType: provided?.serviceType ?? "STANDARD", language: provided?.language ?? "Indonesia", roomRental: provided?.roomRental ?? null, roomPc: provided?.roomPc ?? null, roomServices: provided?.roomServices ?? [], locationType, locationName: locationType === "CLIENT" ? provided?.locationName ?? "" : "", locationAddress: locationType === "CLIENT" ? provided?.locationAddress ?? "" : "", specialInstruction: provided?.specialInstruction ?? "", sessions: provided?.sessions ?? [] };
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
    const requestFormNumber = await nextRequestFormNumber(transaction);
    await sequelize.query("INSERT INTO request_form (id,request_form_number,form_type,quotation_id,created_by_subject,reviewed_by_subject,attachment_file,training_title,request_date,language,training_type,number_student,room_rental,special_instruction,approved_at,account_id,pic_profile_id,status,po_reference,review_note,created_at,updated_at) VALUES (:id,:requestFormNumber,:formType,:quotationId,:subject,NULL,NULL,:trainingTitle,NULL,NULL,NULL,NULL,FALSE,NULL,NULL,:accountId,:picId,'DRAFT',:poReference,NULL,:now,:now)", { replacements: { id, requestFormNumber, formType: input.formType, quotationId: input.quotationId, subject: req.auth!.userId, accountId, picId, trainingTitle, poReference: input.poReference || null, now }, transaction });
    await saveCourses(id, courseInputs, transaction);
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "REQUEST_FORM", objectId: id, after: { status: "DRAFT", quotation_id: input.quotationId, account_id: accountId, pic_profile_id: picId, course_count: courseInputs.length }, processName: "request-form-create" }, transaction);
  });
  return res.status(201).json(await readForm(id, req.auth!.userId));
}));

requestFormsRouter.put("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); const oldRows = await sequelize.query<RequestFormRow>("SELECT * FROM request_form WHERE id=:id AND created_by_subject=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
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
    await sequelize.query("DELETE FROM request_form_course WHERE request_form_id=:id", { replacements: { id: old.id }, transaction });
    await saveCourses(old.id, courseInputs, transaction);
    await sequelize.query("UPDATE request_form SET quotation_id=:quotationId,account_id=:accountId,pic_profile_id=:picId,po_reference=:poReference,training_title=:trainingTitle,updated_at=:now WHERE id=:id", { replacements: { id: old.id, quotationId: old.quotation_id, accountId, picId, poReference: input.poReference || null, trainingTitle, now: new Date() }, transaction });
    const before: Record<string, unknown> = {}; const after: Record<string, unknown> = {};
    if ((old.po_reference ?? null) !== (input.poReference || null)) { before.po_reference = old.po_reference; after.po_reference = input.poReference || null; }
    if (Object.keys(before).length) await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: old.id, before, after, processName: "request-form-edit" }, transaction);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  return res.json(await readForm(old.id, req.auth!.userId));
}));

requestFormsRouter.post("/:id/attachments", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<RequestFormRow>("SELECT * FROM request_form WHERE id=:id AND created_by_subject=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Request Form not found");
  if (rows[0].status !== "DRAFT" && rows[0].status !== "REVISION") throw new AppError(409, "Attachments can only be changed on Draft or Revision Request Forms");
  const file = req.body as AttachmentInput;
  if (!file || typeof file.fileName !== "string" || typeof file.contentBase64 !== "string") throw new AppError(400, "Choose a Word or PDF attachment");
  return res.status(201).json({ item: await uploadAttachment(rows[0].id, file) });
}));

requestFormsRouter.delete("/:id/attachments/:attachmentId", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const form = await sequelize.query<RequestFormRow>("SELECT * FROM request_form WHERE id=:id AND created_by_subject=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  if (!form[0]) throw new AppError(404, "Request Form not found");
  if (form[0].status !== "DRAFT" && form[0].status !== "REVISION") throw new AppError(409, "Attachments can only be changed on Draft or Revision Request Forms");
  const rows = await sequelize.query<{ cloudinary_public_id: string; file_format: string }>("DELETE FROM request_form_attachment WHERE id=:attachmentId AND request_form_id=:id RETURNING cloudinary_public_id,file_format", { replacements: { attachmentId: req.params.attachmentId, id: req.params.id }, type: QueryTypes.SELECT });
  if (!rows[0]) throw new AppError(404, "Attachment not found");
  configureCloudinary(); await cloudinary.uploader.destroy(rows[0].cloudinary_public_id, { resource_type: "raw", type: "authenticated" }).catch(() => undefined);
  return res.status(204).end();
}));

requestFormsRouter.get("/:id/attachments/:attachmentId", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<{ cloudinary_public_id: string; file_format: string }>("SELECT a.cloudinary_public_id,a.file_format FROM request_form_attachment a JOIN request_form rf ON rf.id=a.request_form_id WHERE rf.id=:id AND rf.created_by_subject=:subject AND a.id=:attachmentId", { replacements: { id: req.params.id, attachmentId: req.params.attachmentId, subject: req.auth!.userId }, type: QueryTypes.SELECT });
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
    await sequelize.query("UPDATE request_form SET status='WAITING',review_note=NULL,reviewed_by_subject=NULL,sla_due_at=NULL,sla_notified_at=NULL,updated_at=:now WHERE id=:id", { replacements: { id: item.id, now }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: item.id, before: { status: before }, after: { status: "WAITING" }, processName: "request-form-submit" }, transaction);
  });
  return res.json({ item: { id: item.id, status: "WAITING" } });
}));

requestFormsRouter.post("/:id/withdraw", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const rows = await sequelize.query<RequestFormRow>("SELECT * FROM request_form WHERE id=:id AND created_by_subject=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT, transaction });
    const form = rows[0];
    if (!form) throw new AppError(404, "Request Form not found");
    if (form.status !== "WAITING") throw new AppError(409, "Only a Waiting Request Form can be withdrawn");
    const updated = await sequelize.query<{ id: string }>("UPDATE request_form SET status='DRAFT',review_note=NULL,reviewed_by_subject=NULL,sla_due_at=NULL,sla_notified_at=NULL,updated_at=:now RETURNING id WHERE id=:id AND created_by_subject=:subject AND status='WAITING'", { replacements: { id: form.id, subject: req.auth!.userId, now: new Date() }, type: QueryTypes.SELECT, transaction });
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
  const rows = await sequelize.query<RequestFormRow>("SELECT * FROM request_form WHERE id=:id AND created_by_subject=:subject", { replacements: { id: req.params.id, subject: req.auth!.userId }, type: QueryTypes.SELECT });
  const form = rows[0]; if (!form) throw new AppError(404, "Request Form not found");
  if (form.status !== "DRAFT") throw new AppError(409, "Only a Draft Request Form can be deleted");
  const attachments = await sequelize.query<{ cloudinary_public_id: string }>("SELECT cloudinary_public_id FROM request_form_attachment WHERE request_form_id=:id", { replacements: { id: form.id }, type: QueryTypes.SELECT });
  await sequelize.transaction(async (transaction) => {
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: form.status, account_id: form.account_id, quotation_id: form.quotation_id }, processName: "request-form-delete-draft" }, transaction);
    await sequelize.query("DELETE FROM request_form WHERE id=:id", { replacements: { id: form.id }, transaction });
  });
  if (attachments.length && env.cloudinaryConfigured) { configureCloudinary(); await Promise.all(attachments.map((asset) => cloudinary.uploader.destroy(asset.cloudinary_public_id, { resource_type: "raw", type: "authenticated" }).catch(() => undefined))); }
  return res.status(204).end();
}));

requestFormReviewRouter.use(authorizeActiveRole(ROLES.ADMIN));
requestFormReviewRouter.get("/trainings/:id/detail", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT t.id,t.request_form_id,t.name,t.training_type,t.status,t.expected_students,t.base_fee,t.course_id,c.name AS course_name,a.name AS account_name,a.industry_id,i.name AS industry_name,pp.name AS pic_name,pp.email AS pic_email,
      (SELECT tp.name FROM training_trainer_assignment tta JOIN trainer_profile tp ON tp.id=tta.trainer_profile_id WHERE tta.training_id=t.id AND tta.ended_at IS NULL ORDER BY tta.assigned_at DESC LIMIT 1) AS trainer_name,
      (SELECT r.id FROM training_session ts JOIN booking_room br ON br.session_id=ts.id JOIN room r ON r.id=br.room_id WHERE ts.training_id=t.id LIMIT 1) AS room_id,
      (SELECT r.name FROM training_session ts JOIN booking_room br ON br.session_id=ts.id JOIN room r ON r.id=br.room_id WHERE ts.training_id=t.id LIMIT 1) AS room_name,
      (SELECT r.capacity FROM training_session ts JOIN booking_room br ON br.session_id=ts.id JOIN room r ON r.id=br.room_id WHERE ts.training_id=t.id LIMIT 1) AS room_capacity
      FROM training t JOIN request_form rf ON rf.id=t.request_form_id JOIN account a ON a.id=t.account_id LEFT JOIN industry i ON i.id=a.industry_id JOIN course c ON c.id=t.course_id LEFT JOIN pic_profile pp ON pp.id=t.pic_profile_id WHERE t.id=:id`,
    { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
  );
  if (!rows[0]) throw new AppError(404, "Training not found");
  const form = await readForm(String(rows[0].request_form_id));
  const sessions = await sequelize.query<Record<string, unknown>>(
    "SELECT id,session_number,starts_at,ends_at,class_location FROM training_session WHERE training_id=:id ORDER BY session_number",
    { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
  );
  return res.json({ training: rows[0], form, sessions });
}));
requestFormReviewRouter.get("/trainings/:id/participants", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const exists = await sequelize.query("SELECT id FROM training WHERE id=:id", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  if (!exists.length) throw new AppError(404, "Training not found");
  const items = await sequelize.query<Record<string, unknown>>(
    `SELECT p.id,COALESCE(sp.id,p.student_id) AS student_id,p.student_subject,p.full_name AS name,sp.email,sp.company_role,a.name AS account_name
       FROM participant p LEFT JOIN student_master_profile sp ON sp.keycloak_subject=p.student_subject
       LEFT JOIN account a ON a.id=sp.account_id WHERE p.training_id=:id ORDER BY p.registered_at,p.full_name`,
    { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
  );
  return res.json({ items });
}));
requestFormReviewRouter.get("/trainings/:id/student-options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 150) throw new AppError(400, "Student search is too long");
  const replacements: Record<string, unknown> = {};
  const filter = search ? "AND (sp.name ILIKE :pattern ESCAPE E'\\\\' OR sp.email ILIKE :pattern ESCAPE E'\\\\' OR sp.company_role ILIKE :pattern ESCAPE E'\\\\' OR a.name ILIKE :pattern ESCAPE E'\\\\')" : "";
  if (search) replacements.pattern = `%${escapeLike(search)}%`;
  const items = await sequelize.query<Record<string, unknown>>(
    `SELECT sp.id,sp.name,sp.email,sp.company_role,a.name AS account_name FROM student_master_profile sp JOIN account a ON a.id=sp.account_id
      WHERE sp.portal_enabled IS TRUE ${filter}
      ORDER BY sp.name,sp.id LIMIT 20`,
    { replacements, type: QueryTypes.SELECT },
  );
  return res.json({ items });
}));
requestFormReviewRouter.put("/trainings/:id/participants", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const ids = req.body?.studentIds;
  if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string" || !isUuid(id)) || new Set(ids).size !== ids.length) throw new AppError(400, "Select a valid, unique list of Students");
  const transaction = await sequelize.transaction();
  try {
    const trainingRows = await sequelize.query<{ expected_students: number | null }>("SELECT expected_students FROM training WHERE id=:id FOR UPDATE", { replacements: { id: req.params.id }, type: QueryTypes.SELECT, transaction });
    if (!trainingRows[0]) throw new AppError(404, "Training not found");
    if (trainingRows[0].expected_students != null && ids.length > trainingRows[0].expected_students) throw new AppError(409, "Participant count cannot exceed the expected student count");
    const profiles = ids.length ? await sequelize.query<{ id: string; keycloak_subject: string; name: string }>("SELECT id,keycloak_subject,name FROM student_master_profile WHERE portal_enabled IS TRUE AND id IN (:ids)", { replacements: { ids }, type: QueryTypes.SELECT, transaction }) : [];
    if (profiles.length !== ids.length) throw new AppError(400, "One or more Students are inactive or unavailable");
    const current = await sequelize.query<{ id: string; student_subject: string | null; student_id: string | null }>("SELECT id,student_subject,student_id FROM participant WHERE training_id=:trainingId FOR UPDATE", { replacements: { trainingId: req.params.id }, type: QueryTypes.SELECT, transaction });
    const subjects = new Set(profiles.map((profile) => profile.keycloak_subject));
    const removals = current.filter((participant) => participant.student_subject && !subjects.has(participant.student_subject));
    for (const participant of removals) {
      const refs = await sequelize.query("SELECT id FROM attendance WHERE participant_id=:id UNION ALL SELECT id FROM evaluation WHERE participant_id=:id UNION ALL SELECT id FROM certificate WHERE participant_id=:id UNION ALL SELECT id FROM invoice_detail WHERE participant_id=:id", { replacements: { id: participant.id }, type: QueryTypes.SELECT, transaction });
      if (refs.length) throw new AppError(409, "A participant with training records cannot be removed");
      await sequelize.query("DELETE FROM participant WHERE id=:id", { replacements: { id: participant.id }, transaction });
    }
    const currentSubjects = new Set(current.map((participant) => participant.student_subject).filter(Boolean));
    for (const profile of profiles) if (!currentSubjects.has(profile.keycloak_subject)) await sequelize.query("INSERT INTO participant (id,training_id,student_id,student_subject,full_name,registered_at,created_at,updated_at) VALUES (:id,:trainingId,NULL,:subject,:name,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)", { replacements: { id: randomUUID(), trainingId: req.params.id, subject: profile.keycloak_subject, name: profile.name }, transaction });
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  const items = await sequelize.query<Record<string, unknown>>("SELECT p.id,COALESCE(sp.id,p.student_id) AS student_id,p.student_subject,p.full_name AS name,sp.email,sp.company_role,a.name AS account_name FROM participant p LEFT JOIN student_master_profile sp ON sp.keycloak_subject=p.student_subject LEFT JOIN account a ON a.id=sp.account_id WHERE p.training_id=:id ORDER BY p.registered_at,p.full_name", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  return res.json({ items });
}));
requestFormReviewRouter.get("/trainings", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000); const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "ALL";
  const sessionDate = typeof req.query.sessionDate === "string" ? req.query.sessionDate : "";
  if (search.length > 150 || !["ALL", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"].includes(status) || (sessionDate && !validDate(sessionDate))) throw new AppError(400, "Invalid Training filters");
  const filters = ["1=1"];
  const replacements: Record<string, unknown> = { offset: (page - 1) * pageSize, pageSize };
  if (search) { filters.push("(t.name ILIKE :search ESCAPE E'\\\\' OR rf.request_form_number ILIKE :search ESCAPE E'\\\\')"); replacements.search = escapeLike(search); }
  if (status !== "ALL") { filters.push("t.status=:status"); replacements.status = status; }
  if (sessionDate) { filters.push("EXISTS (SELECT 1 FROM training_session dts WHERE dts.training_id=t.id AND CAST(dts.starts_at AS date)=:sessionDate)"); replacements.sessionDate = sessionDate; }
  const where = filters.join(" AND ");
  const from = `FROM training t
    JOIN request_form rf ON rf.id=t.request_form_id
    JOIN account a ON a.id=t.account_id
    JOIN course c ON c.id=t.course_id
    LEFT JOIN pic_profile pp ON pp.id=t.pic_profile_id`;
  const items = await sequelize.query<Record<string, unknown>>(
    `SELECT t.id,t.name,t.training_type,t.status,t.expected_students,t.base_fee,rf.request_form_number,a.name AS account_name,c.name AS course_name,pp.name AS pic_name,
      (SELECT STRING_AGG(TO_CHAR(CAST(ts.starts_at AS date),'YYYY-MM-DD'),',') FROM training_session ts WHERE ts.training_id=t.id) AS training_dates,
      (SELECT COUNT(1) FROM training_session ts WHERE ts.training_id=t.id) AS session_count,
      (SELECT tp.name FROM training_trainer_assignment tta JOIN trainer_profile tp ON tp.id=tta.trainer_profile_id WHERE tta.training_id=t.id AND tta.ended_at IS NULL ORDER BY tta.assigned_at DESC LIMIT 1) AS trainer_name,
      (SELECT r.name FROM training_session ts JOIN booking_room br ON br.session_id=ts.id JOIN room r ON r.id=br.room_id WHERE ts.training_id=t.id LIMIT 1) AS room_name
      ${from} WHERE ${where} ORDER BY t.created_at DESC LIMIT :pageSize OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT },
  );
  const count = await sequelize.query<{ total: number | string }>(`SELECT COUNT(1) AS total ${from} WHERE ${where}`, { replacements, type: QueryTypes.SELECT });
  return res.json({ items, page, pageSize, total: Number(count[0]?.total ?? 0) });
}));
requestFormReviewRouter.get("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000); const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const status = typeof req.query.status === "string" ? req.query.status : "WAITING";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : "ALL";
  if (!["ALL", "WAITING", "REVISION", "APPROVED"].includes(status)) throw new AppError(400, "Invalid status filter");
  const filters = [status === "ALL" ? "1=1" : "rf.status=:status"];
  const replacements: Record<string, unknown> = { offset: (page - 1) * pageSize, pageSize, status };
  if (accountId !== "ALL") { if (!isUuid(accountId)) throw new AppError(400, "Invalid Account filter"); filters.push("rf.account_id=:accountId"); replacements.accountId = accountId; }
  if (search) { filters.push("(a.name ILIKE :search ESCAPE E'\\\\' OR q.quotation_code ILIKE :search ESCAPE E'\\\\' OR EXISTS (SELECT 1 FROM request_form_course c JOIN course co ON co.id=c.course_id WHERE c.request_form_id=rf.id AND co.name ILIKE :search ESCAPE E'\\\\'))"); replacements.search = escapeLike(search); }
  const where = filters.join(" AND ");
  const from = "FROM request_form rf JOIN account a ON a.id=rf.account_id JOIN pic_profile pp ON pp.id=rf.pic_profile_id LEFT JOIN quotation q ON q.id=rf.quotation_id";
  const rows = await sequelize.query<Record<string, unknown>>(`SELECT rf.id,rf.request_form_number,rf.form_type,rf.status,rf.po_reference,rf.review_note,rf.created_at,rf.updated_at,a.id AS account_id,a.name AS account_name,pp.name AS pic_name,q.quotation_code,(SELECT t.id FROM training t WHERE t.request_form_id=rf.id ORDER BY t.created_at DESC LIMIT 1) AS training_id,(SELECT COUNT(1) FROM request_form_course c WHERE c.request_form_id=rf.id) AS course_count,(SELECT co.name FROM request_form_course c JOIN course co ON co.id=c.course_id WHERE c.request_form_id=rf.id LIMIT 1) AS requested_course,(SELECT c.delivery_type FROM request_form_course c WHERE c.request_form_id=rf.id LIMIT 1) AS delivery_type,(SELECT c.amount_student FROM request_form_course c WHERE c.request_form_id=rf.id LIMIT 1) AS students,(SELECT STRING_AGG(TO_CHAR(s.requested_date,'YYYY-MM-DD'),',') FROM request_form_course c JOIN request_form_session s ON s.request_form_course_id=c.id WHERE c.request_form_id=rf.id) AS requested_dates ${from} WHERE ${where} ORDER BY rf.updated_at ASC LIMIT :pageSize OFFSET :offset`, { replacements, type: QueryTypes.SELECT });
  const count = await sequelize.query<{ total: number | string }>(`SELECT COUNT(1) AS total ${from} WHERE ${where}`, { replacements, type: QueryTypes.SELECT });
  const accounts = await sequelize.query<{ id: string; name: string }>("SELECT DISTINCT a.id,a.name FROM request_form rf JOIN account a ON a.id=rf.account_id ORDER BY a.name", { type: QueryTypes.SELECT });
  return res.json({ items: rows, accounts, page, pageSize, total: Number(count[0]?.total ?? 0) });
}));
requestFormReviewRouter.get("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => res.json(await readForm(req.params.id))));
requestFormReviewRouter.get("/:id/approval-options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const form = await readForm(req.params.id);
  if (form.item.status !== "WAITING") throw new AppError(409, "Only a Waiting Request Form can be approved");
  if (form.courses.length !== 1) throw new AppError(409, "Approval requires exactly one Course in the Request Form");
  const dates = (form.courses[0].sessions as Array<{ date: string }>).map((session) => String(session.date).slice(0, 10));
  const trainers = await sequelize.query<Record<string, unknown>>(
    `SELECT tp.id,COALESCE(tp.name,tp.email) AS name,tp.email,tp.status,tp.rating
       FROM trainer_profile tp
      WHERE tp.status='ACTIVE' AND NOT EXISTS (
        SELECT 1 FROM training_trainer_assignment tta JOIN training t ON t.id=tta.training_id
        JOIN training_session ts ON ts.training_id=t.id
        WHERE tta.trainer_profile_id=tp.id AND tta.ended_at IS NULL AND t.status IN ('SCHEDULED','ONGOING')
          AND CAST(ts.starts_at AS date) IN (:dates)
      ) AND NOT EXISTS (
        SELECT 1 FROM session_trainer_assignment sta JOIN training_session ts ON ts.id=sta.session_id
        JOIN training t ON t.id=ts.training_id
        WHERE sta.trainer_profile_id=tp.id AND sta.ended_at IS NULL AND t.status IN ('SCHEDULED','ONGOING')
          AND CAST(ts.starts_at AS date) IN (:dates)
      ) ORDER BY name`,
    { replacements: { dates }, type: QueryTypes.SELECT },
  );
  const needsRoom = form.courses[0].location_type === "INTERNAL";
  const rooms = needsRoom ? await sequelize.query<Record<string, unknown>>(
    `SELECT r.id,r.room_code,r.name,r.capacity,r.facilities
       FROM room r WHERE r.status='ACTIVE' AND r.capacity>=:capacity AND NOT EXISTS (
         SELECT 1 FROM booking_room br JOIN training_session ts ON ts.id=br.session_id
         JOIN training t ON t.id=ts.training_id
         WHERE br.room_id=r.id AND t.status IN ('SCHEDULED','ONGOING') AND CAST(ts.starts_at AS date) IN (:dates)
       ) ORDER BY r.name`,
    { replacements: { capacity: Number(form.courses[0].amount_student), dates }, type: QueryTypes.SELECT },
  ) : [];
  return res.json({ trainers, rooms, roomRequired: needsRoom, sessions: dates });
}));
requestFormReviewRouter.patch("/:id/approve", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const trainerId = req.body?.trainerId;
  const roomId = req.body?.roomId ?? null;
  const baseFee = Number(req.body?.baseFee);
  const startTime = req.body?.startTime;
  const endTime = req.body?.endTime;
  const validTime = (value: unknown): value is string => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!isUuid(trainerId) || !Number.isFinite(baseFee) || baseFee < 0 || (roomId !== null && !isUuid(roomId)) || !validTime(startTime) || !validTime(endTime) || endTime <= startTime) throw new AppError(400, "Choose a Trainer, valid session times, enter a valid Base Fee, and choose a Room when required");
  const form = await readForm(req.params.id);
  if (form.item.status !== "WAITING") throw new AppError(404, "Waiting Request Form not found");
  if (form.courses.length !== 1) throw new AppError(409, "Approval requires exactly one Course in the Request Form");
  const course = form.courses[0];
  const dates = (course.sessions as Array<{ date: string }>).map((session) => String(session.date).slice(0, 10));
  if (!dates.length) throw new AppError(409, "The Request Form has no requested session dates");
  const options = await sequelize.query<{ id: string }>(
    `SELECT tp.id FROM trainer_profile tp WHERE tp.id=:trainerId AND tp.status='ACTIVE' AND NOT EXISTS (
       SELECT 1 FROM training_trainer_assignment tta JOIN training t ON t.id=tta.training_id
       JOIN training_session ts ON ts.training_id=t.id
       WHERE tta.trainer_profile_id=tp.id AND tta.ended_at IS NULL AND t.status IN ('SCHEDULED','ONGOING') AND CAST(ts.starts_at AS date) IN (:dates)
     ) AND NOT EXISTS (
       SELECT 1 FROM session_trainer_assignment sta JOIN training_session ts ON ts.id=sta.session_id
       JOIN training t ON t.id=ts.training_id
       WHERE sta.trainer_profile_id=tp.id AND sta.ended_at IS NULL AND t.status IN ('SCHEDULED','ONGOING') AND CAST(ts.starts_at AS date) IN (:dates)
     )`, { replacements: { trainerId, dates }, type: QueryTypes.SELECT });
  if (!options.length) throw new AppError(409, "The selected Trainer is inactive or unavailable on a requested date");
  const needsRoom = course.location_type === "INTERNAL";
  if (needsRoom !== Boolean(roomId)) throw new AppError(400, needsRoom ? "Choose a Room for this internal training location" : "A Room must not be assigned to an external or online training");
  if (roomId) {
    const availableRoom = await sequelize.query<{ id: string }>(
      `SELECT r.id FROM room r WHERE r.id=:roomId AND r.status='ACTIVE' AND r.capacity>=:capacity AND NOT EXISTS (
         SELECT 1 FROM booking_room br JOIN training_session ts ON ts.id=br.session_id
         JOIN training t ON t.id=ts.training_id
         WHERE br.room_id=r.id AND t.status IN ('SCHEDULED','ONGOING') AND CAST(ts.starts_at AS date) IN (:dates)
       )`, { replacements: { roomId, capacity: Number(course.amount_student), dates }, type: QueryTypes.SELECT });
    if (!availableRoom.length) throw new AppError(409, "The selected Room is inactive, too small, or unavailable on a requested date");
  }
  const trainingId = randomUUID();
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "INSERT INTO training (id,account_id,name,course_id,syllabus_id,request_form_id,pic_profile_id,expected_students,training_type,status,base_fee,created_at,updated_at) VALUES (:id,:accountId,:name,:courseId,NULL,:requestFormId,:picId,:expectedStudents,:type,'SCHEDULED',:baseFee,:now,:now)",
      { replacements: { id: trainingId, accountId: form.item.account_id, name: String(form.item.training_title ?? "").slice(0, 255), courseId: course.course_id, requestFormId: form.item.id, picId: form.item.pic_profile_id, expectedStudents: Number(course.amount_student), type: course.delivery_type, baseFee, now }, transaction },
    );
    for (let index = 0; index < dates.length; index += 1) {
      const sessionId = randomUUID();
      await sequelize.query(
        "INSERT INTO training_session (id,training_id,session_number,starts_at,ends_at,class_location,created_at,updated_at) VALUES (:id,:trainingId,:number,CAST(:date AS date) + CAST(:startMinutes AS integer) * INTERVAL '1 minute',CAST(:date AS date) + CAST(:endMinutes AS integer) * INTERVAL '1 minute',:classLocation,:now,:now)",
        { replacements: { id: sessionId, trainingId, number: index + 1, date: dates[index], startMinutes: Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)), endMinutes: Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5)), classLocation: course.delivery_type.startsWith("ONLINE") ? "ONLINE" : "OFFLINE", now }, transaction },
      );
      if (roomId) await sequelize.query(
        "INSERT INTO booking_room (id,session_id,room_id,booking_name,detail_booking,start_time,end_time,created_at,updated_at) VALUES (:id,:sessionId,:roomId,:bookingName,:detail,'00:00:00','23:59:59',:now,:now)",
        { replacements: { id: randomUUID(), sessionId, roomId, bookingName: String(form.item.training_title ?? "").slice(0, 150), detail: `Request Form ${form.item.request_form_number}`, now }, transaction },
      );
    }
    await sequelize.query(
      "INSERT INTO training_trainer_assignment (id,training_id,trainer_profile_id,assignment_type,assigned_at,ended_at,assigned_by_subject,ended_by_subject,created_at,updated_at) VALUES (:id,:trainingId,:trainerId,'PRIMARY',:now,NULL,:subject,NULL,:now,:now)",
      { replacements: { id: randomUUID(), trainingId, trainerId, subject: req.auth!.userId, now }, transaction },
    );
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "TRAINING", objectId: trainingId, after: { request_form_id: form.item.id, request_form_number: form.item.request_form_number, account_id: form.item.account_id, pic_profile_id: form.item.pic_profile_id, course_id: course.course_id, expected_students: Number(course.amount_student), status: "SCHEDULED", training_type: course.delivery_type, trainer_id: trainerId, room_id: roomId, base_fee: baseFee, session_dates: dates }, processName: "request-form-approve-create-training" }, transaction);
    const [updatedCount] = await RequestForm.update(
      { status: "APPROVED", review_note: null, reviewed_by_subject: req.auth!.userId, approved_at: now, sla_due_at: null, sla_notified_at: null },
      { where: { id: form.item.id, status: "WAITING" }, transaction },
    );
    if (!updatedCount) throw new AppError(409, "The Request Form has already been processed");
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.item.id, before: { status: "WAITING", training_id: null, trainer_id: null, room_id: null, base_fee: null }, after: { status: "APPROVED", training_id: trainingId, trainer_id: trainerId, room_id: roomId, base_fee: baseFee }, processName: "request-form-approve" }, transaction);
  });
  return res.json({ item: { id: form.item.id, requestFormNumber: form.item.request_form_number, status: "APPROVED", trainingId } });
}));
requestFormReviewRouter.patch("/:id/return", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  if (typeof req.body?.note !== "string" || !req.body.note.trim() || req.body.note.length > 4000) throw new AppError(400, "A revision note is required");
  const rows = await sequelize.query<RequestFormRow>("SELECT * FROM request_form WHERE id=:id AND status='WAITING'", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  const form = rows[0]; if (!form) throw new AppError(404, "Waiting Request Form not found");
  await sequelize.transaction(async (transaction) => {
    await sequelize.query("UPDATE request_form SET status='REVISION',review_note=:note,reviewed_by_subject=:subject,sla_due_at=NULL,sla_notified_at=NULL,updated_at=:now WHERE id=:id", { replacements: { id: form.id, note: req.body.note.trim(), subject: req.auth!.userId, now: new Date() }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: "WAITING", review_note: form.review_note }, after: { status: "REVISION", review_note: req.body.note.trim() }, processName: "request-form-return-for-revision" }, transaction);
  });
  return res.json({ item: { id: form.id, status: "REVISION", review_note: req.body.note.trim() } });
}));
