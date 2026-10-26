import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { Op, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { Account, Attendance, BookingRoom, Certificate, Course, Evaluation, Industry, InvoiceDetail, Participant, PicAccountAssignment, PicProfile, Quotation, QuotationOrder, RequestForm, RequestFormAttachment, RequestFormCourse, RequestFormNumberSequence, RequestFormSession, Room, SalesAccountAssignment, SessionTrainerAssignment, StudentMasterProfile, Training, TrainingSession, TrainingTrainerAssignment, TrainerProfile } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import Joi from "joi";
import { validateBody } from "../../utils/joi-validation";
import { trainingDates } from "./training-dates";

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
const pageNumber = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;
const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

async function nextRequestFormNumber(transaction: Transaction) {
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date()));
  const [sequence, created] = await RequestFormNumberSequence.findOrCreate({ where: { number_year: year }, defaults: { number_year: year, last_number: 1 }, transaction });
  if (!created) await sequence.increment("last_number", { by: 1, transaction });
  await sequence.reload({ transaction });
  return `RF-${year}-${String(sequence.last_number).padStart(4, "0")}`;
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
  const rows = await Course.findAll({ where: { id: { [Op.in]: courses.map((course) => course.courseId) } }, attributes: ["id", "name"], raw: true });
  const names = new Map(rows.map((row) => [row.id, row.name]));
  const title = courses.map((course) => names.get(course.courseId)).filter(Boolean).join(" + ");
  if (!title || title.length > 255) throw new AppError(400, "Could not create a Training Title from the selected Courses");
  return title;
}

async function validateAccountAndPic(accountId: string, picId: string, salesSubject: string) {
  const account = await Account.findOne({ where: { id: accountId, status: "ACTIVE", account_type: "CORPORATE" }, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: salesSubject, ended_at: null }, required: true }] });
  const pic = await PicProfile.findOne({ where: { id: picId, status: "ACTIVE" }, include: [{ model: PicAccountAssignment, as: "accountAssignments", where: { account_id: accountId, ended_at: null }, required: true }] });
  if (!account || !pic) throw new AppError(400, "Choose an active Account assigned to you and an active PIC belonging to that Account");
}

async function approvedQuotation(quotationId: string, salesSubject: string) {
  const quote = await Quotation.findOne({ where: { id: quotationId, created_by_subject: salesSubject, status: "APPROVED", deleted_at: null }, include: [
    { model: Account, as: "account", where: { status: "ACTIVE", account_type: "CORPORATE" }, required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", where: { sales_subject: salesSubject, ended_at: null }, required: true }] },
    { model: PicProfile, as: "pic", where: { status: "ACTIVE" }, required: true },
  ] });
  if (!quote) throw new AppError(400, "Only an active Approved Quotation assigned to you can be selected");
  const picAssignment = await PicAccountAssignment.findOne({ where: { account_id: quote.account_id, pic_profile_id: quote.pic_profile_id, ended_at: null } });
  if (!picAssignment) throw new AppError(400, "Only an active Approved Quotation assigned to you can be selected");
  const lines = await QuotationOrder.findAll({ where: { quotation_id: quotationId }, include: [{ model: Course, as: "course", attributes: ["name", "duration_minutes"], required: true }] });
  if (!lines.length) throw new AppError(409, "The approved Quotation has no Course details");
  return { quote, lines: lines.map((line) => ({ course_id: line.course_id, amount_student: line.amount_student, class_type: line.class_type, course_name: (line.get("course") as Course).name, duration_minutes: (line.get("course") as Course).duration_minutes })) };
}

async function validateCourses(courses: CourseInput[], allowInactive = false) {
  const rows = await Course.findAll({ where: { id: { [Op.in]: courses.map((course) => course.courseId) }, ...(allowInactive ? {} : { status: "ACTIVE" }) }, attributes: ["id"], raw: true });
  if (rows.length !== courses.length) throw new AppError(400, "One or more Courses are inactive or unavailable");
}

async function readForm(id: string, subject?: string) {
  const form = await RequestForm.findOne({ where: { id, ...(subject ? { created_by_subject: subject } : {}) }, include: [
    { model: Account, as: "account", required: false, include: [{ model: Industry, as: "industry", required: false }] },
    { model: PicProfile, as: "pic", required: false },
    { model: Quotation, as: "quotation", required: false },
    { model: RequestFormCourse, as: "courses", required: false, include: [{ model: Course, as: "course", required: true }, { model: RequestFormSession, as: "sessions", required: false }] },
    { model: RequestFormAttachment, as: "attachments", required: false },
  ] });
  if (!form) throw new AppError(404, "Request Form not found");
  const [training] = await Promise.all([Training.findOne({ where: { request_form_id: id }, attributes: ["id"], order: [["created_at", "DESC"]], raw: true })]);
  const account = form.get("account") as Account | null;
  const pic = form.get("pic") as PicProfile | null;
  const quotation = form.get("quotation") as Quotation | null;
  const accountIndustry = account?.get("industry") as Industry | null;
  const item = { ...form.toJSON(), account_name: account?.name ?? null, industry_name: accountIndustry?.name ?? null, pic_name: pic?.name ?? null, pic_email: pic?.email ?? null, quotation_code: quotation?.quotation_code ?? null, quotation_class_type: quotation?.class_type ?? null, training_id: training?.id ?? null };
  const courses = (form.get("courses") as RequestFormCourse[]).map((entry) => {
    const course = entry.get("course") as Course;
    const sessions = entry.get("sessions") as RequestFormSession[];
    return { ...entry.toJSON(), course_name: course.name, duration_minutes: course.duration_minutes, room_services: JSON.parse(String(entry.room_services || "[]")) as string[], sessions: sessions.map((session) => ({ id: session.id, date: session.requested_date })) };
  });
  const attachments = (form.get("attachments") as RequestFormAttachment[]).map((attachment) => ({ id: attachment.id, file_name: attachment.file_name, file_size: attachment.file_size, file_format: attachment.file_format, created_at: attachment.created_at, download_url: requestFormDownloadUrl(attachment.cloudinary_public_id, attachment.file_format) }));
  return { item, courses, attachments };
}

async function sessionsOnDates(dates: string[]) {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const start = new Date(`${sorted[0]}T00:00:00.000Z`);
  const end = new Date(`${sorted[sorted.length - 1]}T23:59:59.999Z`);
  const candidates = await TrainingSession.findAll({ where: { starts_at: { [Op.gte]: start, [Op.lte]: end } }, include: [{ model: Training, as: "training", where: { status: { [Op.in]: ["SCHEDULED", "ONGOING"] } }, attributes: ["id"], required: true }] });
  const wanted = new Set(dates);
  return candidates.filter((session) => wanted.has(new Date(session.starts_at).toISOString().slice(0, 10)));
}

async function unavailableTrainerIds(dates: string[]) {
  const sessions = await sessionsOnDates(dates);
  if (!sessions.length) return new Set<string>();
  const trainingIds = [...new Set(sessions.map((session) => session.training_id))];
  const sessionIds = sessions.map((session) => session.id);
  const [trainingAssignments, sessionAssignments] = await Promise.all([
    TrainingTrainerAssignment.findAll({ where: { training_id: { [Op.in]: trainingIds }, ended_at: null }, attributes: ["trainer_profile_id"] }),
    SessionTrainerAssignment.findAll({ where: { session_id: { [Op.in]: sessionIds }, ended_at: null }, attributes: ["trainer_profile_id"] }),
  ]);
  return new Set([...trainingAssignments, ...sessionAssignments].map((assignment) => assignment.trainer_profile_id));
}

async function unavailableRoomIds(dates: string[]) {
  const sessions = await sessionsOnDates(dates);
  if (!sessions.length) return new Set<string>();
  const bookings = await BookingRoom.findAll({ where: { session_id: { [Op.in]: sessions.map((session) => session.id) } }, attributes: ["room_id"] });
  return new Set(bookings.map((booking) => booking.room_id));
}

async function saveCourses(requestFormId: string, courses: CourseInput[], transaction: Transaction) {
  const courseRows: Array<Record<string, unknown>> = [];
  const sessionRows: Array<Record<string, unknown>> = [];
  for (const course of courses) {
    const courseRowId = randomUUID();
    courseRows.push({ id: courseRowId, request_form_id: requestFormId, course_id: course.courseId, delivery_type: course.deliveryType, service_type: course.serviceType, amount_student: course.amountStudent, language: course.language, room_rental: course.roomRental, room_pc: course.roomPc, room_services: JSON.stringify(course.roomServices), location_type: course.locationType, location_name: course.locationType === "CLIENT" ? course.locationName : null, location_address: course.locationType === "CLIENT" ? course.locationAddress : null, special_instruction: course.specialInstruction || null });
    for (const session of course.sessions) sessionRows.push({ id: randomUUID(), request_form_course_id: courseRowId, requested_date: session.date, start_time: null, end_time: null });
  }
  if (courseRows.length) await RequestFormCourse.bulkCreate(courseRows, { transaction });
  if (sessionRows.length) await RequestFormSession.bulkCreate(sessionRows, { transaction });
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
  const id = randomUUID();
  await RequestFormAttachment.create({ id, request_form_id: formId, file_name: input.fileName, file_size: buffer.byteLength, file_format: extension, cloudinary_public_id: asset.publicId, cloudinary_asset_id: asset.assetId });
  return { id, file_name: input.fileName, file_size: buffer.byteLength, file_format: extension, download_url: requestFormDownloadUrl(asset.publicId, extension) };
}

requestFormsRouter.use(authorizeActiveRole(ROLES.SALES));

requestFormsRouter.get("/options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const formType = req.query.formType ?? "REQUEST";
  if (formType !== "REQUEST" && formType !== "REGISTRATION") throw new AppError(400, "Invalid form type");
  const [accounts, courses, allQuotations] = await Promise.all([
    Account.findAll({ where: { status: "ACTIVE", account_type: "CORPORATE" }, attributes: ["id", "account_code", "name"], include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }], order: [["name", "ASC"]], raw: true }),
    Course.findAll({ where: { status: "ACTIVE" }, attributes: ["id", "name", "duration_minutes"], order: [["name", "ASC"]], raw: true }),
    Quotation.findAll({ where: { created_by_subject: req.auth!.userId, status: "APPROVED", deleted_at: null }, include: [
      { model: Account, as: "account", where: { status: "ACTIVE", account_type: "CORPORATE" }, attributes: ["name"], required: true, include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] },
      { model: PicProfile, as: "pic", where: { status: "ACTIVE" }, attributes: ["name"], required: true },
    ], order: [["updated_at", "DESC"]] }),
  ]);
  const allowedTypes = formType === "REGISTRATION" ? ["PUBLIC", "ONLINE_PUBLIC"] : ["PRIVATE", "INHOUSE", "ONLINE_PRIVATE"];
  return res.json({ accounts, courses, quotations: allQuotations.filter((quotation) => allowedTypes.includes(quotation.class_type)).map((quotation) => ({ id: quotation.id, quotation_code: quotation.quotation_code, class_type: quotation.class_type, account_name: (quotation.get("account") as Account).name, pic_name: (quotation.get("pic") as PicProfile).name })) });
}));

requestFormsRouter.get("/accounts/:accountId/pics", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const account = await Account.findOne({ where: { id: req.params.accountId, status: "ACTIVE" }, include: [{ model: SalesAccountAssignment, as: "salesAssignments", attributes: [], where: { sales_subject: req.auth!.userId, ended_at: null }, required: true }] });
  if (!account) throw new AppError(404, "Account not found");
  const items = await PicProfile.findAll({ where: { status: "ACTIVE" }, attributes: ["id", "name", "email"], include: [{ model: PicAccountAssignment, as: "accountAssignments", attributes: [], where: { account_id: req.params.accountId, ended_at: null }, required: true }], order: [["name", "ASC"]], raw: true });
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
  const where: Record<string, unknown> = { created_by_subject: req.auth!.userId, form_type: formType };
  if (status !== "ALL") where.status = status;
  if (accountId !== "ALL") where.account_id = accountId;
  if (deliveryType !== "ALL") {
    const matchingCourses = await RequestFormCourse.findAll({ where: { delivery_type: deliveryType }, attributes: ["request_form_id"], raw: true });
    where.id = { [Op.in]: [...new Set(matchingCourses.map((course) => course.request_form_id))] };
  }
  if (search) Object.assign(where, { [Op.or]: [
    { po_reference: { [Op.iLike]: escapeLike(search) } }, { "$quotation.quotation_code$": { [Op.iLike]: escapeLike(search) } },
    { "$account.name$": { [Op.iLike]: escapeLike(search) } }, { "$courses.course.name$": { [Op.iLike]: escapeLike(search) } },
  ] });
  const include: any[] = [
    { model: Account, as: "account", attributes: ["name"], required: true },
    { model: PicProfile, as: "pic", attributes: ["name"], required: true },
    { model: Quotation, as: "quotation", attributes: ["quotation_code"], required: false },
    { model: RequestFormCourse, as: "courses", required: false, include: [{ model: Course, as: "course", attributes: ["name"], required: false }, { model: RequestFormSession, as: "sessions", attributes: ["requested_date"], required: false }] },
    { model: RequestFormAttachment, as: "attachments", attributes: ["id"], required: false },
  ];
  const { rows, count } = await RequestForm.findAndCountAll({ where, include, distinct: true, order: [["updated_at", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize });
  const ids = rows.map((row) => row.id);
  const trainings = ids.length ? await Training.findAll({ where: { request_form_id: { [Op.in]: ids } }, attributes: ["id", "request_form_id"], order: [["created_at", "DESC"]], raw: true }) : [];
  const items = rows.map((row) => {
    const account = row.get("account") as Account; const pic = row.get("pic") as PicProfile; const quotation = row.get("quotation") as Quotation | null;
    const courses = row.get("courses") as RequestFormCourse[]; const attachments = row.get("attachments") as RequestFormAttachment[];
    const names = courses.map((entry) => (entry.get("course") as Course | undefined)?.name).filter(Boolean);
    const dates = courses.flatMap((entry) => (entry.get("sessions") as RequestFormSession[] | undefined) ?? []).map((session) => String(session.requested_date).slice(0, 10));
    return { id: row.id, request_form_number: row.request_form_number, form_type: row.get("form_type"), quotation_id: row.quotation_id, status: row.status, po_reference: row.po_reference, review_note: row.review_note, created_at: row.created_at, updated_at: row.updated_at, account_name: account.name, pic_name: pic.name, quotation_code: quotation?.quotation_code ?? null, training_id: trainings.find((training) => training.request_form_id === row.id)?.id ?? null, course_count: courses.length, attachment_count: attachments.length, requested_course: names.join(", "), delivery_type: courses.map((entry) => entry.delivery_type).sort()[0] ?? null, students: courses.reduce((sum, entry) => sum + Number(entry.amount_student), 0) || null, requested_dates: dates.join(",") || null };
  });
  return res.json({ items, page, pageSize, total: count });
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
    await RequestForm.create({ id, request_form_number: requestFormNumber, form_type: input.formType, quotation_id: input.quotationId, created_by_subject: req.auth!.userId, reviewed_by_subject: null, attachment_file: null, training_title: trainingTitle, request_date: null, language: null, training_type: null, number_student: null, room_rental: false, special_instruction: null, approved_at: null, account_id: accountId, pic_profile_id: picId, status: "DRAFT", po_reference: input.poReference || null, review_note: null }, { transaction });
    await saveCourses(id, courseInputs, transaction);
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "REQUEST_FORM", objectId: id, after: { status: "DRAFT", quotation_id: input.quotationId, account_id: accountId, pic_profile_id: picId, course_count: courseInputs.length }, processName: "request-form-create" }, transaction);
  });
  return res.status(201).json(await readForm(id, req.auth!.userId));
}));

requestFormsRouter.put("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const input = parseInput(req.body); const old = await RequestForm.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId } });
  if (!old) throw new AppError(404, "Request Form not found");
  if (old.status !== "DRAFT" && old.status !== "REVISION") throw new AppError(409, "Only a Draft or returned Revision Request Form can be edited");
  if (input.formType !== old.get("form_type")) throw new AppError(400, "Form type cannot be changed");
  let accountId = input.accountId; let picId = input.picId; let courseInputs = input.courses;
  if (old.quotation_id) {
    if (input.quotationId !== old.quotation_id) throw new AppError(400, "The source Approved Quotation cannot be changed");
    const { quote, lines } = await approvedQuotation(old.quotation_id, req.auth!.userId);
    if (input.courses.some((course) => !lines.some((row) => row.course_id === course.courseId))) throw new AppError(400, "Only Courses included in the source Approved Quotation can be selected");
    if (!old.account_id || !old.pic_profile_id) throw new AppError(409, "The Request Form has no linked Account or PIC");
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
    const oldCourses = await RequestFormCourse.findAll({ where: { request_form_id: old.id }, attributes: ["id"], transaction });
    const oldCourseIds = oldCourses.map((course) => course.id);
    if (oldCourseIds.length) await RequestFormSession.destroy({ where: { request_form_course_id: { [Op.in]: oldCourseIds } }, transaction });
    await RequestFormCourse.destroy({ where: { request_form_id: old.id }, transaction });
    await saveCourses(old.id, courseInputs, transaction);
    await old.update({ quotation_id: old.quotation_id, account_id: accountId, pic_profile_id: picId, po_reference: input.poReference || null, training_title: trainingTitle }, { transaction });
    const before: Record<string, unknown> = {}; const after: Record<string, unknown> = {};
    if ((old.po_reference ?? null) !== (input.poReference || null)) { before.po_reference = old.po_reference; after.po_reference = input.poReference || null; }
    if (Object.keys(before).length) await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: old.id, before, after, processName: "request-form-edit" }, transaction);
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  return res.json(await readForm(old.id, req.auth!.userId));
}));

requestFormsRouter.post("/:id/attachments", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const form = await RequestForm.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId } });
  if (!form) throw new AppError(404, "Request Form not found");
  if (form.status !== "DRAFT" && form.status !== "REVISION") throw new AppError(409, "Attachments can only be changed on Draft or Revision Request Forms");
  const file = req.body as AttachmentInput;
  if (!file || typeof file.fileName !== "string" || typeof file.contentBase64 !== "string") throw new AppError(400, "Choose a Word or PDF attachment");
  return res.status(201).json({ item: await uploadAttachment(form.id, file) });
}));

requestFormsRouter.delete("/:id/attachments/:attachmentId", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const form = await RequestForm.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId } });
  if (!form) throw new AppError(404, "Request Form not found");
  if (form.status !== "DRAFT" && form.status !== "REVISION") throw new AppError(409, "Attachments can only be changed on Draft or Revision Request Forms");
  const attachment = await RequestFormAttachment.findOne({ where: { id: req.params.attachmentId, request_form_id: form.id } });
  if (!attachment) throw new AppError(404, "Attachment not found");
  await attachment.destroy();
  configureCloudinary(); await cloudinary.uploader.destroy(attachment.cloudinary_public_id, { resource_type: "raw", type: "authenticated" }).catch(() => undefined);
  return res.status(204).end();
}));

requestFormsRouter.get("/:id/attachments/:attachmentId", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const [form, attachment] = await Promise.all([
    RequestForm.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId }, attributes: ["id"] }),
    RequestFormAttachment.findOne({ where: { id: req.params.attachmentId, request_form_id: req.params.id }, attributes: ["cloudinary_public_id", "file_format"] }),
  ]);
  if (!form || !attachment) throw new AppError(404, "Attachment not found");
  return res.json({ url: requestFormDownloadUrl(attachment.cloudinary_public_id, attachment.file_format), expiresInSeconds: 300 });
}));

requestFormsRouter.post("/:id/submit", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const detail = await readForm(req.params.id, req.auth!.userId); const item = detail.item as RequestFormRow;
  if (item.status !== "DRAFT" && item.status !== "REVISION") throw new AppError(409, "Only a Draft or returned Revision Request Form can be submitted");
  if (!detail.attachments.length) throw new AppError(400, "Upload at least one RF Attachment before submitting to Admin (QPD)");
  if (!detail.courses.length || detail.courses.some((course) => !(course.sessions as unknown[]).length)) throw new AppError(400, "Add at least one scheduled session for every Course before submitting");
  const before = item.status; const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await RequestForm.update({ status: "WAITING", review_note: null, reviewed_by_subject: null, sla_due_at: null, sla_notified_at: null }, { where: { id: item.id }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: item.id, before: { status: before }, after: { status: "WAITING" }, processName: "request-form-submit" }, transaction);
  });
  return res.json({ item: { id: item.id, status: "WAITING" } });
}));

requestFormsRouter.post("/:id/withdraw", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const form = await RequestForm.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!form) throw new AppError(404, "Request Form not found");
    if (form.status !== "WAITING") throw new AppError(409, "Only a Waiting Request Form can be withdrawn");
    const [updated] = await RequestForm.update({ status: "DRAFT", review_note: null, reviewed_by_subject: null, sla_due_at: null, sla_notified_at: null }, { where: { id: form.id, created_by_subject: req.auth!.userId, status: "WAITING" }, transaction });
    if (!updated) throw new AppError(409, "The Request Form has already been processed by Admin");
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: "WAITING" }, after: { status: "DRAFT" }, processName: "request-form-withdraw" }, transaction);
    await transaction.commit();
    return res.json({ item: { id: form.id, status: "DRAFT" } });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

requestFormsRouter.delete("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const form = await RequestForm.findOne({ where: { id: req.params.id, created_by_subject: req.auth!.userId } });
  if (!form) throw new AppError(404, "Request Form not found");
  if (form.status !== "DRAFT") throw new AppError(409, "Only a Draft Request Form can be deleted");
  const attachments = await RequestFormAttachment.findAll({ where: { request_form_id: form.id }, attributes: ["cloudinary_public_id"] });
  await sequelize.transaction(async (transaction) => {
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: form.status, account_id: form.account_id, quotation_id: form.quotation_id }, processName: "request-form-delete-draft" }, transaction);
    const courseRows = await RequestFormCourse.findAll({ where: { request_form_id: form.id }, attributes: ["id"], transaction });
    await RequestFormAttachment.destroy({ where: { request_form_id: form.id }, transaction });
    if (courseRows.length) await RequestFormSession.destroy({ where: { request_form_course_id: { [Op.in]: courseRows.map((course) => course.id) } }, transaction });
    await RequestFormCourse.destroy({ where: { request_form_id: form.id }, transaction });
    await form.destroy({ transaction });
  });
  if (attachments.length && env.cloudinaryConfigured) { configureCloudinary(); await Promise.all(attachments.map((asset) => cloudinary.uploader.destroy(asset.cloudinary_public_id, { resource_type: "raw", type: "authenticated" }).catch(() => undefined))); }
  return res.status(204).end();
}));

requestFormReviewRouter.use(authorizeActiveRole(ROLES.ADMIN));
requestFormReviewRouter.get("/trainings/:id/detail", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const training = await Training.findByPk(req.params.id, { include: [
    { model: RequestForm, as: "requestForm", required: true },
    { model: Account, as: "account", required: true, include: [{ model: Industry, as: "industry", required: false }] },
    { model: Course, as: "course", required: true }, { model: PicProfile, as: "pic", required: false },
    { model: TrainingSession, as: "sessions", required: false, include: [{ model: BookingRoom, as: "roomBookings", required: false, include: [{ model: Room, as: "room", required: false }] }] },
    { model: TrainingTrainerAssignment, as: "trainerAssignments", where: { ended_at: null }, required: false, include: [{ model: TrainerProfile, as: "trainerProfile", required: true }] },
  ] });
  if (!training) throw new AppError(404, "Training not found");
  const form = await readForm(training.request_form_id);
  const account = training.get("account") as Account; const industry = account.get("industry") as Industry | null;
  const course = training.get("course") as Course; const pic = training.get("pic") as PicProfile | null;
  const trainerAssignment = (training.get("trainerAssignments") as TrainingTrainerAssignment[])[0];
  const trainer = trainerAssignment?.get("trainerProfile") as TrainerProfile | undefined;
  const sessionRows = training.get("sessions") as TrainingSession[];
  const booking = sessionRows.flatMap((session) => session.get("roomBookings") as BookingRoom[]).map((row) => row.get("room") as Room | null).find(Boolean);
  const sessions = sessionRows.sort((a, b) => a.session_number - b.session_number).map(({ id, session_number, starts_at, ends_at, class_location }) => ({ id, session_number, starts_at, ends_at, class_location }));
  return res.json({ training: { ...training.toJSON(), training_dates: trainingDates(sessions.map((session) => session.starts_at)), course_name: course.name, account_name: account.name, industry_id: account.industry_id, industry_name: industry?.name ?? null, pic_name: pic?.name ?? null, pic_email: pic?.email ?? null, trainer_name: trainer?.name ?? null, room_id: booking?.id ?? null, room_name: booking?.name ?? null, room_capacity: booking?.capacity ?? null }, form, sessions });
}));
requestFormReviewRouter.get("/trainings/:id/participants", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const exists = await Training.findByPk(req.params.id, { attributes: ["id"] });
  if (!exists) throw new AppError(404, "Training not found");
  const participants = await Participant.findAll({ where: { training_id: req.params.id }, order: [["registered_at", "ASC"], ["full_name", "ASC"]] });
  const profiles = participants.length ? await StudentMasterProfile.findAll({ where: { keycloak_subject: { [Op.in]: participants.map((participant) => participant.student_subject).filter((subject): subject is string => Boolean(subject)) } }, include: [{ model: Account, as: "account", attributes: ["name"], required: false }], raw: true, nest: true }) : [];
  const items = participants.map((participant) => {
    const profile = profiles.find((row) => row.keycloak_subject === participant.student_subject) as any;
    return { id: participant.id, student_id: profile?.id ?? participant.student_id, student_subject: participant.student_subject, name: participant.full_name, email: profile?.email ?? null, company_role: profile?.company_role ?? null, account_name: profile?.account?.name ?? null };
  });
  return res.json({ items });
}));
requestFormReviewRouter.get("/trainings/:id/student-options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (search.length > 150) throw new AppError(400, "Student search is too long");
  const where: Record<string, unknown> = { portal_enabled: true };
  if (search) Object.assign(where, { [Op.or]: [
    { name: { [Op.iLike]: escapeLike(search) } }, { email: { [Op.iLike]: escapeLike(search) } },
    { company_role: { [Op.iLike]: escapeLike(search) } }, { "$account.name$": { [Op.iLike]: escapeLike(search) } },
  ] });
  const profiles = await StudentMasterProfile.findAll({ where, include: [{ model: Account, as: "account", attributes: ["name"], required: true }], attributes: ["id", "name", "email", "company_role"], order: [["name", "ASC"], ["id", "ASC"]], limit: 20 });
  const items = profiles.map((profile) => ({ id: profile.id, name: profile.name, email: profile.email, company_role: profile.company_role, account_name: (profile.get("account") as Account).name }));
  return res.json({ items });
}));
requestFormReviewRouter.put("/trainings/:id/participants", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const ids = req.body?.studentIds;
  if (!Array.isArray(ids) || ids.some((id: unknown) => typeof id !== "string" || !isUuid(id)) || new Set(ids).size !== ids.length) throw new AppError(400, "Select a valid, unique list of Students");
  const transaction = await sequelize.transaction();
  try {
    const training = await Training.findByPk(req.params.id, { attributes: ["id", "expected_students"], transaction, lock: transaction.LOCK.UPDATE });
    if (!training) throw new AppError(404, "Training not found");
    if (training.expected_students != null && ids.length > training.expected_students) throw new AppError(409, "Participant count cannot exceed the expected student count");
    const profiles = ids.length ? await StudentMasterProfile.findAll({ where: { portal_enabled: true, id: { [Op.in]: ids } }, attributes: ["id", "keycloak_subject", "name"], transaction }) : [];
    if (profiles.length !== ids.length) throw new AppError(400, "One or more Students are inactive or unavailable");
    const current = await Participant.findAll({ where: { training_id: req.params.id }, attributes: ["id", "student_subject", "student_id"], transaction, lock: transaction.LOCK.UPDATE });
    const subjects = new Set(profiles.map((profile) => profile.keycloak_subject));
    const removals = current.filter((participant) => participant.student_subject && !subjects.has(participant.student_subject));
    for (const participant of removals) {
      const [attendance, evaluations, certificates, invoiceDetails] = await Promise.all([
        Attendance.count({ where: { participant_id: participant.id }, transaction }), Evaluation.count({ where: { participant_id: participant.id }, transaction }),
        Certificate.count({ where: { participant_id: participant.id }, transaction }), InvoiceDetail.count({ where: { participant_id: participant.id }, transaction }),
      ]);
      if (attendance + evaluations + certificates + invoiceDetails > 0) throw new AppError(409, "A participant with training records cannot be removed");
      await Participant.destroy({ where: { id: participant.id }, transaction });
    }
    const currentSubjects = new Set(current.map((participant) => participant.student_subject).filter(Boolean));
    const additions = profiles.filter((profile) => !currentSubjects.has(profile.keycloak_subject)).map((profile) => ({ id: randomUUID(), training_id: req.params.id, student_id: null, student_subject: profile.keycloak_subject, full_name: profile.name, registered_at: new Date() }));
    if (additions.length) await Participant.bulkCreate(additions, { transaction });
    await transaction.commit();
  } catch (error) { await transaction.rollback(); throw error; }
  const participants = await Participant.findAll({ where: { training_id: req.params.id }, order: [["registered_at", "ASC"], ["full_name", "ASC"]] });
  const participantProfiles = participants.length ? await StudentMasterProfile.findAll({ where: { keycloak_subject: { [Op.in]: participants.map((participant) => participant.student_subject).filter((subject): subject is string => Boolean(subject)) } }, include: [{ model: Account, as: "account", attributes: ["name"], required: false }] }) : [];
  const items = participants.map((participant) => { const profile = participantProfiles.find((candidate) => candidate.keycloak_subject === participant.student_subject); return { id: participant.id, student_id: profile?.id ?? participant.student_id, student_subject: participant.student_subject, name: participant.full_name, email: profile?.email ?? null, company_role: profile?.company_role ?? null, account_name: (profile?.get("account") as Account | undefined)?.name ?? null }; });
  return res.json({ items });
}));
requestFormReviewRouter.get("/trainings", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000); const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "ALL";
  const sessionDate = typeof req.query.sessionDate === "string" ? req.query.sessionDate : "";
  if (search.length > 150 || !["ALL", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"].includes(status) || (sessionDate && !validDate(sessionDate))) throw new AppError(400, "Invalid Training filters");
  const where: Record<string, unknown> = {};
  if (status !== "ALL") where.status = status;
  if (search) Object.assign(where, { [Op.or]: [{ name: { [Op.iLike]: escapeLike(search) } }, { "$requestForm.request_form_number$": { [Op.iLike]: escapeLike(search) } }] });
  const dateRange = sessionDate ? { starts_at: { [Op.gte]: new Date(`${sessionDate}T00:00:00.000Z`), [Op.lt]: new Date(`${sessionDate}T23:59:59.999Z`) } } : undefined;
  const { rows: trainings, count } = await Training.findAndCountAll({ where, include: [
    { model: RequestForm, as: "requestForm", attributes: ["request_form_number"], required: true },
    { model: Account, as: "account", attributes: ["name"], required: true }, { model: Course, as: "course", attributes: ["name"], required: true },
    { model: PicProfile, as: "pic", attributes: ["name"], required: false },
    ...(sessionDate ? [{ model: TrainingSession, as: "sessions", attributes: ["id"], where: dateRange, required: true }] : []),
  ], distinct: true, order: [["created_at", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize });
  const ids = trainings.map((training) => training.id);
  const [sessions, assignments] = ids.length ? await Promise.all([
    TrainingSession.findAll({ where: { training_id: { [Op.in]: ids } }, attributes: ["id", "training_id", "starts_at"], include: [{ model: BookingRoom, as: "roomBookings", attributes: ["room_id"], include: [{ model: Room, as: "room", attributes: ["name"], required: false }], required: false }] }),
    TrainingTrainerAssignment.findAll({ where: { training_id: { [Op.in]: ids }, ended_at: null }, include: [{ model: TrainerProfile, as: "trainerProfile", attributes: ["name"], required: true }], order: [["assigned_at", "DESC"]] }),
  ]) : [[], []];
  const items = trainings.map((training) => {
    const requestForm = training.get("requestForm") as RequestForm; const account = training.get("account") as Account; const course = training.get("course") as Course; const pic = training.get("pic") as PicProfile | null;
    const ownSessions = sessions.filter((session) => session.training_id === training.id);
    const assignment = assignments.find((row) => row.training_id === training.id);
    const roomBooking = ownSessions.flatMap((session) => session.get("roomBookings") as BookingRoom[]).find(Boolean);
    const room = roomBooking?.get("room") as Room | undefined;
    return { id: training.id, name: training.name, training_type: training.training_type, status: training.status, expected_students: training.expected_students, base_fee: training.base_fee, request_form_number: requestForm.request_form_number, account_name: account.name, course_name: course.name, pic_name: pic?.name ?? null, training_dates: trainingDates(ownSessions.map((session) => session.starts_at)), session_count: ownSessions.length, trainer_name: (assignment?.get("trainerProfile") as TrainerProfile | undefined)?.name ?? null, room_name: room?.name ?? null };
  });
  return res.json({ items, page, pageSize, total: count });
}));
requestFormReviewRouter.get("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 1_000_000); const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) throw new AppError(400, "Invalid pagination");
  const status = typeof req.query.status === "string" ? req.query.status : "WAITING";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : "ALL";
  if (!["ALL", "WAITING", "REVISION", "APPROVED"].includes(status)) throw new AppError(400, "Invalid status filter");
  const where: Record<string, unknown> = {};
  if (status !== "ALL") where.status = status;
  if (accountId !== "ALL") { if (!isUuid(accountId)) throw new AppError(400, "Invalid Account filter"); where.account_id = accountId; }
  if (search) Object.assign(where, { [Op.or]: [{ "$account.name$": { [Op.iLike]: escapeLike(search) } }, { "$quotation.quotation_code$": { [Op.iLike]: escapeLike(search) } }, { "$courses.course.name$": { [Op.iLike]: escapeLike(search) } }] });
  const { rows, count } = await RequestForm.findAndCountAll({ where, include: [
    { model: Account, as: "account", attributes: ["id", "name"], required: true }, { model: PicProfile, as: "pic", attributes: ["name"], required: true },
    { model: Quotation, as: "quotation", attributes: ["quotation_code"], required: false },
    { model: RequestFormCourse, as: "courses", required: false, include: [{ model: Course, as: "course", attributes: ["name"], required: false }, { model: RequestFormSession, as: "sessions", attributes: ["requested_date"], required: false }] },
  ], distinct: true, order: [["updated_at", "ASC"]], limit: pageSize, offset: (page - 1) * pageSize });
  const ids = rows.map((row) => row.id);
  const [trainings, accountRefs] = await Promise.all([
    ids.length ? Training.findAll({ where: { request_form_id: { [Op.in]: ids } }, attributes: ["id", "request_form_id"], order: [["created_at", "DESC"]], raw: true }) : Promise.resolve([]),
    RequestForm.findAll({ where: { account_id: { [Op.ne]: null } }, attributes: ["account_id"], raw: true }),
  ]);
  const accountIds = [...new Set(accountRefs.map((row) => row.account_id).filter((id): id is string => Boolean(id)))];
  const accounts = accountIds.length ? await Account.findAll({ where: { id: { [Op.in]: accountIds } }, attributes: ["id", "name"], order: [["name", "ASC"]], raw: true }) : [];
  const items = rows.map((row) => {
    const account = row.get("account") as Account; const pic = row.get("pic") as PicProfile; const quotation = row.get("quotation") as Quotation | null;
    const courses = row.get("courses") as RequestFormCourse[]; const firstCourse = courses[0]; const course = firstCourse?.get("course") as Course | undefined;
    const dates = courses.flatMap((entry) => entry.get("sessions") as RequestFormSession[]).map((session) => String(session.requested_date).slice(0, 10));
    return { id: row.id, request_form_number: row.request_form_number, form_type: row.form_type, status: row.status, po_reference: row.po_reference, review_note: row.review_note, created_at: row.created_at, updated_at: row.updated_at, account_id: account.id, account_name: account.name, pic_name: pic.name, quotation_code: quotation?.quotation_code ?? null, training_id: trainings.find((training) => training.request_form_id === row.id)?.id ?? null, course_count: courses.length, requested_course: course?.name ?? null, delivery_type: firstCourse?.delivery_type ?? null, students: firstCourse?.amount_student ?? null, requested_dates: dates.join(",") || null };
  });
  return res.json({ items, accounts, page, pageSize, total: count });
}));
requestFormReviewRouter.get("/:id", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => res.json(await readForm(req.params.id))));
requestFormReviewRouter.get("/:id/approval-options", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const form = await readForm(req.params.id);
  if (form.item.status !== "WAITING") throw new AppError(409, "Only a Waiting Request Form can be approved");
  if (form.courses.length !== 1) throw new AppError(409, "Approval requires exactly one Course in the Request Form");
  const dates = (form.courses[0].sessions as Array<{ date: string }>).map((session) => String(session.date).slice(0, 10));
  const unavailableTrainers = await unavailableTrainerIds(dates);
  const trainerProfiles = await TrainerProfile.findAll({ where: { status: "ACTIVE", id: { [Op.notIn]: [...unavailableTrainers] } }, attributes: ["id", "name", "email", "status", "rating"], order: [["name", "ASC"]], raw: true });
  const trainers = trainerProfiles.map((trainer) => ({ ...trainer, name: trainer.name ?? trainer.email }));
  const needsRoom = form.courses[0].location_type === "INTERNAL";
  const busyRooms = needsRoom ? await unavailableRoomIds(dates) : new Set<string>();
  const rooms = needsRoom ? await Room.findAll({ where: { status: "ACTIVE", capacity: { [Op.gte]: Number(form.courses[0].amount_student) }, id: { [Op.notIn]: [...busyRooms] } }, attributes: ["id", "room_code", "name", "capacity", "facilities"], order: [["name", "ASC"]], raw: true }) : [];
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
  const unavailableTrainers = await unavailableTrainerIds(dates);
  const selectedTrainer = await TrainerProfile.findOne({ where: { id: trainerId, status: "ACTIVE" }, attributes: ["id"] });
  if (!selectedTrainer || unavailableTrainers.has(trainerId)) throw new AppError(409, "The selected Trainer is inactive or unavailable on a requested date");
  const needsRoom = course.location_type === "INTERNAL";
  if (needsRoom !== Boolean(roomId)) throw new AppError(400, needsRoom ? "Choose a Room for this internal training location" : "A Room must not be assigned to an external or online training");
  if (roomId) {
    const [availableRoom, unavailableRooms] = await Promise.all([
      Room.findOne({ where: { id: roomId, status: "ACTIVE", capacity: { [Op.gte]: Number(course.amount_student) } }, attributes: ["id"] }),
      unavailableRoomIds(dates),
    ]);
    if (!availableRoom || unavailableRooms.has(roomId)) throw new AppError(409, "The selected Room is inactive, too small, or unavailable on a requested date");
  }
  const trainingId = randomUUID();
  const now = new Date();
  await sequelize.transaction(async (transaction) => {
    await Training.create({ id: trainingId, account_id: form.item.account_id, name: String(form.item.training_title ?? "").slice(0, 255), course_id: course.course_id, syllabus_id: null, request_form_id: form.item.id, pic_profile_id: form.item.pic_profile_id, expected_students: Number(course.amount_student), training_type: course.delivery_type, status: "SCHEDULED", base_fee: baseFee }, { transaction });
    const sessionRows: Array<Record<string, unknown>> = [];
    const roomRows: Array<Record<string, unknown>> = [];
    for (let index = 0; index < dates.length; index += 1) {
      const sessionId = randomUUID();
      sessionRows.push({ id: sessionId, training_id: trainingId, session_number: index + 1, starts_at: new Date(`${dates[index]}T${startTime}:00+07:00`), ends_at: new Date(`${dates[index]}T${endTime}:00+07:00`), class_location: course.delivery_type.startsWith("ONLINE") ? "ONLINE" : "OFFLINE" });
      if (roomId) roomRows.push({ id: randomUUID(), session_id: sessionId, room_id: roomId, booking_name: String(form.item.training_title ?? "").slice(0, 150), detail_booking: `Request Form ${form.item.request_form_number}`, start_time: "00:00:00", end_time: "23:59:59" });
    }
    await TrainingSession.bulkCreate(sessionRows, { transaction });
    if (roomRows.length) await BookingRoom.bulkCreate(roomRows, { transaction });
    await TrainingTrainerAssignment.create({ id: randomUUID(), training_id: trainingId, trainer_profile_id: trainerId, assignment_type: "PRIMARY", assigned_at: now, ended_at: null, assigned_by_subject: req.auth!.userId, ended_by_subject: null }, { transaction });
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
  const form = await RequestForm.findOne({ where: { id: req.params.id, status: "WAITING" } });
  if (!form) throw new AppError(404, "Waiting Request Form not found");
  await sequelize.transaction(async (transaction) => {
    await RequestForm.update({ status: "REVISION", review_note: req.body.note.trim(), reviewed_by_subject: req.auth!.userId, sla_due_at: null, sla_notified_at: null }, { where: { id: form.id, status: "WAITING" }, transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "REQUEST_FORM", objectId: form.id, before: { status: "WAITING", review_note: form.review_note }, after: { status: "REVISION", review_note: req.body.note.trim() }, processName: "request-form-return-for-revision" }, transaction);
  });
  return res.json({ item: { id: form.id, status: "REVISION", review_note: req.body.note.trim() } });
}));
