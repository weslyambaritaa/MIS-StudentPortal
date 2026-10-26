import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { QueryTypes, type Transaction } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { env } from "../../config/env";
import { sequelize } from "../../database/sequelize";
import { Course, CourseCategory, Syllabus } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";
import Joi from "joi";
import { validateBody } from "../../utils/joi-validation";

export const coursesRouter = Router();
const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
type SyllabusInput = { kind: "URL"; url: string } | { kind: "UPLOAD"; fileName: string; contentBase64: string };
type CourseInput = { courseCode: string; name: string; categoryId: string; durationDays: number; level: typeof LEVELS[number]; status?: "ACTIVE" | "INACTIVE"; syllabus?: SyllabusInput };
const escapeLike = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
const parsePage = (value: unknown, fallback: number, max: number) => value === undefined ? fallback : typeof value === "string" && /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;

function parseInput(body: unknown, editing = false): CourseInput {
  const raw = validateBody<Record<string, unknown>>(Joi.object({
    courseCode: Joi.string().trim().min(1).max(50).required(),
    name: Joi.string().trim().min(1).max(150).required(),
    categoryId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    durationDays: Joi.number().integer().min(1).max(365).required(),
    level: Joi.string().valid(...LEVELS).required(),
    status: editing ? Joi.string().valid("ACTIVE", "INACTIVE").required() : Joi.forbidden(),
    syllabus: Joi.alternatives().try(
      Joi.object({ kind: Joi.valid("URL").required(), url: Joi.string().uri({ scheme: ["http", "https"] }).max(2048).required() }).unknown(false),
      Joi.object({ kind: Joi.valid("UPLOAD").required(), fileName: Joi.string().max(255).required(), contentBase64: Joi.string().max(14_000_000).pattern(/^[A-Za-z0-9+/]+={0,2}$/).required() }).unknown(false),
    ).allow(null).optional(),
  }).unknown(false), body);
  if (typeof raw.courseCode !== "string" || !raw.courseCode.trim() || raw.courseCode.trim().length > 50 || typeof raw.name !== "string" || !raw.name.trim() || raw.name.trim().length > 150 || typeof raw.categoryId !== "string" || !/^[0-9a-f-]{36}$/i.test(raw.categoryId) || !Number.isSafeInteger(raw.durationDays) || Number(raw.durationDays) < 1 || Number(raw.durationDays) > 365 || !LEVELS.includes(raw.level as typeof LEVELS[number])) throw new AppError(400, "Enter a course code, name, category, duration, and course level");
  if (editing && raw.status !== "ACTIVE" && raw.status !== "INACTIVE") throw new AppError(400, "Course status must be Active or Inactive");
  let syllabus: SyllabusInput | undefined;
  if (raw.syllabus !== undefined && raw.syllabus !== null) {
    if (!raw.syllabus || typeof raw.syllabus !== "object") throw new AppError(400, "Invalid syllabus upload");
    const value = raw.syllabus as Record<string, unknown>;
    if (value.kind === "URL" && typeof value.url === "string" && value.url.trim().length <= 2048) {
      let parsed: URL;
      try { parsed = new URL(value.url.trim()); } catch { throw new AppError(400, "Enter a valid syllabus URL"); }
      if (!(["https:", "http:"].includes(parsed.protocol))) throw new AppError(400, "Syllabus URL must use HTTP or HTTPS");
      syllabus = { kind: "URL", url: parsed.toString() };
    } else if (value.kind === "UPLOAD" && typeof value.fileName === "string" && value.fileName.toLowerCase().endsWith(".pdf") && typeof value.contentBase64 === "string" && value.contentBase64.length <= 14_000_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(value.contentBase64)) {
      const pdf = Buffer.from(value.contentBase64, "base64");
      if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")) || pdf.byteLength > 10 * 1024 * 1024) throw new AppError(400, "Syllabus must be a valid PDF no larger than 10 MB");
      syllabus = { kind: "UPLOAD", fileName: value.fileName.slice(0, 255), contentBase64: value.contentBase64 };
    } else throw new AppError(400, "Choose a PDF upload or enter a syllabus URL");
  }
  const status = editing ? raw.status as "ACTIVE" | "INACTIVE" : undefined;
  return { courseCode: raw.courseCode.trim(), name: raw.name.trim(), categoryId: raw.categoryId, durationDays: Number(raw.durationDays), level: raw.level as typeof LEVELS[number], ...(status ? { status } : {}), syllabus };
}

function configureCloudinary() {
  if (!env.cloudinaryConfigured) throw new AppError(503, "Course syllabus storage is not configured");
  cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true });
}

async function uploadSyllabus(buffer: Buffer, publicId: string) {
  configureCloudinary();
  return new Promise<{ url: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: "image", type: "authenticated", access_mode: "authenticated", folder: "course-syllabi", public_id: publicId, overwrite: false, format: "pdf" }, (error, result) => {
      if (error || !result?.secure_url) return reject(error ?? new Error("Cloudinary returned no syllabus URL"));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}

function syllabusDownloadUrl(publicId: unknown) {
  if (typeof publicId !== "string" || !publicId || !env.cloudinaryConfigured) return null;
  configureCloudinary();
  return cloudinary.utils.private_download_url(publicId, "pdf", { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300 });
}

async function persistSyllabus(courseId: string, input: SyllabusInput, transaction: Transaction) {
  if (input.kind === "URL") {
    return Syllabus.create({ id: randomUUID(), course_id: courseId, file_url: input.url, cloudinary_public_id: null }, { transaction });
  }
  const uploaded = await uploadSyllabus(Buffer.from(input.contentBase64, "base64"), `course-${courseId}-${randomUUID()}`);
  return Syllabus.create({ id: randomUUID(), course_id: courseId, file_url: uploaded.url, cloudinary_public_id: uploaded.publicId }, { transaction });
}

function versionLabel(createdAt: unknown) {
  const date = createdAt instanceof Date ? createdAt : new Date(String(createdAt));
  if (Number.isNaN(date.getTime())) return "—";
  return `V ${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;
}

async function syllabusRows(courseIds: string[]) {
  if (!courseIds.length) return [];
  return sequelize.query<Record<string, unknown>>(
    "SELECT id, course_id, file_url, cloudinary_public_id, created_at FROM syllabus WHERE course_id IN (:ids) ORDER BY created_at DESC, id DESC",
    { replacements: { ids: courseIds }, type: QueryTypes.SELECT },
  );
}

function withLatestSyllabus<T extends Record<string, unknown>>(rows: T[], versions: Record<string, unknown>[]) {
  const byCourse = new Map<string, Record<string, unknown>[]>();
  for (const version of versions) {
    const courseId = String(version.course_id);
    byCourse.set(courseId, [...(byCourse.get(courseId) ?? []), { id: version.id, url: version.file_url, download_url: syllabusDownloadUrl(version.cloudinary_public_id), created_at: version.created_at, version: versionLabel(version.created_at) }]);
  }
  return rows.map(row => {
    const syllabuses = byCourse.get(String(row.id)) ?? [];
    return { ...row, latest_syllabus: syllabuses[0] ?? null, syllabus_version_count: syllabuses.length };
  });
}

coursesRouter.get("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = parsePage(req.query.page, 1, 100_000);
  const pageSize = parsePage(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
  const { search, categoryId, level, status } = req.query;
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) return res.status(400).json({ message: "Invalid search" });
  if (categoryId !== undefined && categoryId !== "ALL" && (typeof categoryId !== "string" || !/^[0-9a-f-]{36}$/i.test(categoryId))) return res.status(400).json({ message: "Invalid category filter" });
  if (level !== undefined && level !== "ALL" && !LEVELS.includes(level as typeof LEVELS[number])) return res.status(400).json({ message: "Invalid level filter" });
  if (status !== undefined && status !== "ALL" && status !== "ACTIVE" && status !== "INACTIVE") return res.status(400).json({ message: "Invalid status filter" });
  const conditions: string[] = [];
  const replacements: Record<string, string | number> = { offset: (page - 1) * pageSize, pageSize };
  if (search) { conditions.push("(c.course_code ILIKE :search ESCAPE E'\\\\' OR c.name ILIKE :search ESCAPE E'\\\\' OR category.name ILIKE :search ESCAPE E'\\\\')"); replacements.search = escapeLike(search as string); }
  if (categoryId && categoryId !== "ALL") { conditions.push("c.category_id = :categoryId"); replacements.categoryId = categoryId as string; }
  if (level && level !== "ALL") { conditions.push("c.level = :level"); replacements.level = level as string; }
  if (status && status !== "ALL") { conditions.push("c.status = :status"); replacements.status = status as string; }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await sequelize.query<{ total: number | string }>(`SELECT COUNT(1) AS total FROM course c JOIN course_category category ON category.id=c.category_id ${where}`, { replacements, type: QueryTypes.SELECT });
  const rows = await sequelize.query<Record<string, unknown>>(
    `SELECT c.id,c.course_code,c.name,c.category_id,category.name AS category_name,c.duration_minutes,c.level,c.status,c.created_at,c.updated_at
       FROM course c JOIN course_category category ON category.id=c.category_id ${where}
       ORDER BY c.course_code ASC LIMIT :pageSize OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT },
  );
  const items = withLatestSyllabus(rows, await syllabusRows(rows.map(row => String(row.id))));
  return res.json({ items, page, pageSize, total: Number(count[0]?.total ?? 0) });
}));

coursesRouter.get("/:id/syllabuses", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  if (!course) return res.status(404).json({ message: "Course not found" });
  const rows = await sequelize.query<Record<string, unknown>>("SELECT id,file_url,cloudinary_public_id,created_at FROM syllabus WHERE course_id=:id ORDER BY created_at DESC,id DESC", { replacements: { id: course.id }, type: QueryTypes.SELECT });
  return res.json({ items: rows.map(row => ({ id: row.id, url: row.file_url, download_url: syllabusDownloadUrl(row.cloudinary_public_id), created_at: row.created_at, version: versionLabel(row.created_at) })) });
}));

coursesRouter.get("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const rows = await sequelize.query<Record<string, unknown>>(
    "SELECT c.id,c.course_code,c.name,c.category_id,category.name AS category_name,c.duration_minutes,c.level,c.status,c.created_at,c.updated_at FROM course c JOIN course_category category ON category.id=c.category_id WHERE c.id=:id",
    { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
  );
  if (!rows[0]) return res.status(404).json({ message: "Course not found" });
  const versions = await sequelize.query<Record<string, unknown>>("SELECT id,file_url,cloudinary_public_id,created_at FROM syllabus WHERE course_id=:id ORDER BY created_at DESC,id DESC", { replacements: { id: req.params.id }, type: QueryTypes.SELECT });
  const syllabuses = versions.map(row => ({ id: row.id, url: row.file_url, download_url: syllabusDownloadUrl(row.cloudinary_public_id), created_at: row.created_at, version: versionLabel(row.created_at) }));
  return res.json({ item: { ...rows[0], duration_days: Math.max(1, Math.ceil(Number(rows[0].duration_minutes) / 480)), syllabuses } });
}));

coursesRouter.post("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const input = parseInput(req.body);
  if (!await CourseCategory.findByPk(input.categoryId)) throw new AppError(400, "Select an existing Course Category");
  const duplicates = await Course.findOne({ where: { course_code: input.courseCode } });
  if (duplicates) throw new AppError(409, "Course code is already in use");
  const transaction = await sequelize.transaction();
  try {
    const course = await Course.create({ id: randomUUID(), course_code: input.courseCode, category_id: input.categoryId, name: input.name, duration_minutes: input.durationDays * 480, level: input.level, module_url: null, status: "ACTIVE" }, { transaction });
    const syllabus = input.syllabus ? await persistSyllabus(course.id, input.syllabus, transaction) : null;
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "COURSE", objectId: course.id, after: { course_code: course.course_code, name: course.name, category_id: course.category_id, duration_days: input.durationDays, level: course.level, status: course.status, syllabus_id: syllabus?.id ?? null }, processName: "course-create" }, transaction);
    await transaction.commit();
    return res.status(201).json({ item: { ...course.toJSON(), duration_days: input.durationDays, latest_syllabus: syllabus ? { id: syllabus.id, url: syllabus.file_url, version: versionLabel(syllabus.created_at) } : null } });
  } catch (error) { await transaction.rollback(); if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") throw new AppError(409, "Course code is already in use"); throw error; }
}));

coursesRouter.put("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const input = parseInput(req.body, true);
  if (!await CourseCategory.findByPk(input.categoryId)) throw new AppError(400, "Select an existing Course Category");
  const transaction = await sequelize.transaction();
  try {
    const course = await Course.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!course) { await transaction.rollback(); return res.status(404).json({ message: "Course not found" }); }
    const codeInUse = await Course.findOne({ where: { course_code: input.courseCode }, transaction });
    if (codeInUse && codeInUse.id !== course.id) { await transaction.rollback(); return res.status(409).json({ message: "Course code is already in use" }); }
    const before: Record<string, unknown> = { course_code: course.course_code, name: course.name, category_id: course.category_id, duration_minutes: course.duration_minutes, level: course.level, status: course.status };
    await course.update({ course_code: input.courseCode, name: input.name, category_id: input.categoryId, duration_minutes: input.durationDays * 480, level: input.level, status: input.status }, { transaction });
    const syllabus = input.syllabus ? await persistSyllabus(course.id, input.syllabus, transaction) : null;
    const after: Record<string, unknown> = { course_code: course.course_code, name: course.name, category_id: course.category_id, duration_minutes: course.duration_minutes, level: course.level, status: course.status };
    if (syllabus) {
      before.syllabus_added_id = null;
      after.syllabus_added_id = syllabus.id;
    }
    const changedFields = Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (changedFields.length) {
      const changedBefore = Object.fromEntries(changedFields.map((key) => [key, before[key]]));
      const changedAfter = Object.fromEntries(changedFields.map((key) => [key, after[key]]));
      await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "COURSE", objectId: course.id, before: changedBefore, after: changedAfter, processName: "course-update" }, transaction);
    }
    await transaction.commit();
    return res.json({ item: { ...course.toJSON(), duration_days: input.durationDays } });
  } catch (error) { await transaction.rollback(); if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") throw new AppError(409, "Course code is already in use"); throw error; }
}));

coursesRouter.delete("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const course = await Course.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!course) { await transaction.rollback(); return res.status(404).json({ message: "Course not found" }); }
    const [quotations, trainings] = await Promise.all([
      sequelize.query<{ total: number | string }>("SELECT COUNT(1) AS total FROM quotation_order WHERE course_id=:id", { replacements: { id: course.id }, type: QueryTypes.SELECT, transaction }),
      sequelize.query<{ total: number | string }>("SELECT COUNT(1) AS total FROM training WHERE course_id=:id", { replacements: { id: course.id }, type: QueryTypes.SELECT, transaction }),
    ]);
    if (Number(quotations[0]?.total ?? 0) + Number(trainings[0]?.total ?? 0) > 0) { await transaction.rollback(); return res.status(409).json({ message: "This Course is used by a Quotation or Training and cannot be deleted. You can deactivate it instead." }); }
    const assets = await sequelize.query<{ cloudinary_public_id: string }>("SELECT cloudinary_public_id FROM syllabus WHERE course_id=:id AND cloudinary_public_id IS NOT NULL", { replacements: { id: course.id }, type: QueryTypes.SELECT, transaction });
    const before = { course_code: course.course_code, name: course.name, category_id: course.category_id };
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "COURSE", objectId: course.id, before, processName: "course-delete" }, transaction);
    await Syllabus.destroy({ where: { course_id: course.id }, transaction });
    await course.destroy({ transaction });
    await transaction.commit();
    if (env.cloudinaryConfigured && assets.length) {
      configureCloudinary();
      await Promise.all(assets.map(asset => cloudinary.uploader.destroy(asset.cloudinary_public_id, { resource_type: "image", type: "authenticated" }).catch(() => undefined)));
    }
    return res.status(204).end();
  } catch (error) { await transaction.rollback(); if ((error as { name?: string }).name === "SequelizeForeignKeyConstraintError") return res.status(409).json({ message: "This Course is in use and cannot be deleted. You can deactivate it instead." }); throw error; }
}));
