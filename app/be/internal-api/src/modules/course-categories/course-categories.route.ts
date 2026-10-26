import { randomUUID } from "node:crypto";
import { Op, col, fn, literal } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { Course, CourseCategory } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";

export const courseCategoriesRouter = Router();

function pageNumber(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 150;
}

function codeFor(value: string | number | bigint): string {
  return `CAT-${String(value).padStart(2, "0")}`;
}

async function nextCategoryCode(transaction: Awaited<ReturnType<typeof sequelize.transaction>>) {
  const row = await CourseCategory.findOne({ attributes: [[literal("nextval('course_category_code_seq')"), "value"]], raw: true, transaction }) as unknown as { value: number | string | bigint };
  return codeFor(row.value);
}

courseCategoriesRouter.get("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE_CATEGORY", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 100_000);
  const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });
  const search = req.query.search;
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) return res.status(400).json({ message: "Invalid search" });

  const escapedSearch = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const where = escapedSearch ? { [Op.or]: [
    { category_code: { [Op.iLike]: escapedSearch } },
    { name: { [Op.iLike]: escapedSearch } },
  ] } : undefined;
  const [total, items] = await Promise.all([
    CourseCategory.count({ where }),
    CourseCategory.findAll({
      attributes: ["id", "category_code", "name", "created_at", "updated_at", [fn("COUNT", col("courses.id")), "amount_courses"]],
      where,
      include: [{ model: Course, as: "courses", attributes: [], required: false }],
      group: ["CourseCategory.id", "CourseCategory.category_code", "CourseCategory.name", "CourseCategory.created_at", "CourseCategory.updated_at"],
      order: [["category_code", "ASC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
  ]);
  return res.json({ items, page, pageSize, total });
}));

courseCategoriesRouter.post("/", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE_CATEGORY", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const { name } = req.body ?? {};
  if (!validName(name)) return res.status(400).json({ message: "Course Category name is invalid" });
  const transaction = await sequelize.transaction();
  try {
    const category = await CourseCategory.create({ id: randomUUID(), category_code: await nextCategoryCode(transaction), name: name.trim() }, { transaction });
    await appendRequestAuditTrail(req, { action: "CREATE", objectType: "COURSE_CATEGORY", objectId: category.id, after: { category_code: category.category_code, name: category.name }, processName: "course-category-create" }, transaction);
    await transaction.commit();
    return res.status(201).json({ item: category });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

courseCategoriesRouter.put("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE_CATEGORY", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const { name } = req.body ?? {};
  if (!validName(name)) return res.status(400).json({ message: "Course Category name is invalid" });
  const transaction = await sequelize.transaction();
  try {
    const category = await CourseCategory.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!category) { await transaction.rollback(); return res.status(404).json({ message: "Course Category not found" }); }
    const nextName = name.trim();
    if (category.name === nextName) { await transaction.commit(); return res.json({ item: category }); }
    const before = { name: category.name };
    await category.update({ name: nextName }, { transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "COURSE_CATEGORY", objectId: category.id, before, after: { name: nextName }, processName: "course-category-update" }, transaction);
    await transaction.commit();
    return res.json({ item: category });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));

courseCategoriesRouter.delete("/:id", authorizeActiveRole(ROLES.ADMIN), authorizeCapability("COURSE_CATEGORY", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const category = await CourseCategory.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!category) { await transaction.rollback(); return res.status(404).json({ message: "Course Category not found" }); }
    const amountCourses = await Course.count({ where: { category_id: category.id }, transaction });
    if (amountCourses > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: "Course Category is in use by one or more Courses and cannot be deleted" });
    }
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "COURSE_CATEGORY", objectId: category.id, before: { category_code: category.category_code, name: category.name }, processName: "course-category-delete" }, transaction);
    await category.destroy({ transaction });
    await transaction.commit();
    return res.status(204).end();
  } catch (error) {
    await transaction.rollback();
    if ((error as { name?: string }).name === "SequelizeForeignKeyConstraintError") return res.status(409).json({ message: "Course Category is in use by one or more Courses and cannot be deleted" });
    throw error;
  }
}));
