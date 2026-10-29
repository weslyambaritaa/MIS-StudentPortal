import { randomUUID } from "node:crypto";
import { Op, QueryTypes, col, fn } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { Account, AccountIndustryHistory, Industry } from "../../database/models";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { appendRequestAuditTrail } from "../audit-trail/audit-trail.service";

export const industriesRouter = Router();

function pageNumber(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 150;
}

function validStatus(value: unknown): value is "ACTIVE" | "INACTIVE" {
  return value === "ACTIVE" || value === "INACTIVE";
}

function codeFor(value: string | number | bigint): string {
  return `IND-${String(value).padStart(2, "0")}`;
}

async function nextIndustryCode(transaction: Awaited<ReturnType<typeof sequelize.transaction>>) {
  const [row] = await sequelize.query<{ value: number | string | bigint }>("SELECT nextval('industry_code_seq') AS value", { type: QueryTypes.SELECT, transaction });
  return codeFor(row.value);
}

/** Internal roles can read; the stored active-role matrix controls the exact capability. */
industriesRouter.get("/", authorizeCapability("INDUSTRY", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const page = pageNumber(req.query.page, 1, 100_000);
  const pageSize = pageNumber(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });

  const search = req.query.search;
  const status = req.query.status;
  if (search !== undefined && (typeof search !== "string" || search.length > 150)) return res.status(400).json({ message: "Invalid search" });
  if (status !== undefined && status !== "ALL" && !validStatus(status)) return res.status(400).json({ message: "Invalid status" });

  const escapedSearch = search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const where = {
    ...(escapedSearch ? { [Op.or]: [
      { industry_code: { [Op.iLike]: escapedSearch } },
      { name: { [Op.iLike]: escapedSearch } },
    ] } : {}),
    ...(status && status !== "ALL" ? { status } : {}),
  };
  const [total, rows] = await Promise.all([
    Industry.count({ where }),
    Industry.findAll({
      attributes: ["id", "industry_code", "name", "status", "created_at", "updated_at", [fn("COUNT", col("accounts.id")), "amount_account"]],
      where,
      include: [{ model: Account, as: "accounts", attributes: [], required: false }],
      // Count the joined accounts before applying pagination to industry groups.
      subQuery: false,
      group: ["Industry.id", "Industry.industry_code", "Industry.name", "Industry.status", "Industry.created_at", "Industry.updated_at"],
      order: [["industry_code", "ASC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
  ]);
  const ids = rows.map((row) => row.id);
  const histories = ids.length ? await AccountIndustryHistory.findAll({
    attributes: ["industry_id"],
    where: { industry_id: { [Op.in]: ids } },
    group: ["industry_id"],
    raw: true,
  }) as unknown as Array<{ industry_id: string }> : [];
  const everUsedIds = new Set(histories.map((row) => row.industry_id));
  const items = rows.map((row) => ({ ...row.get({ plain: true }), ever_used: everUsedIds.has(row.id) }));
  return res.json({ items, page, pageSize, total });
}));

industriesRouter.post("/", authorizeCapability("INDUSTRY", ACCESS_ACTIONS.CREATE), asyncHandler(async (req, res) => {
  const { name, status = "ACTIVE" } = req.body ?? {};
  if (!validName(name) || !validStatus(status)) return res.status(400).json({ message: "Industry name or status is invalid" });
  const transaction = await sequelize.transaction();
  try {
    const industry = await Industry.create({ id: randomUUID(), industry_code: await nextIndustryCode(transaction), name: name.trim(), status }, { transaction });
    await appendRequestAuditTrail(req, {
      action: "CREATE", objectType: "INDUSTRY", objectId: industry.id,
      after: { industry_code: industry.industry_code, name: industry.name, status: industry.status },
      processName: "industry-create",
    }, transaction);
    await transaction.commit();
    return res.status(201).json({ item: industry });
  } catch (error) {
    await transaction.rollback();
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Industry name already exists" });
    throw error;
  }
}));

industriesRouter.put("/:id", authorizeCapability("INDUSTRY", ACCESS_ACTIONS.EDIT), asyncHandler(async (req, res) => {
  const { name, status } = req.body ?? {};
  if (!validName(name) || !validStatus(status)) return res.status(400).json({ message: "Industry name or status is invalid" });
  const transaction = await sequelize.transaction();
  try {
    const industry = await Industry.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!industry) { await transaction.rollback(); return res.status(404).json({ message: "Industry not found" }); }
    if (industry.industry_code === "IND-PERSONAL" && status !== "ACTIVE") {
      await transaction.rollback();
      return res.status(409).json({ message: "The Personal Industry must remain active" });
    }
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const field of ["name", "status"] as const) {
      if (industry[field] !== (field === "name" ? name.trim() : status)) {
        before[field] = industry[field];
        after[field] = field === "name" ? name.trim() : status;
      }
    }
    if (!Object.keys(after).length) { await transaction.commit(); return res.json({ item: industry }); }
    await industry.update(after, { transaction });
    await appendRequestAuditTrail(req, { action: "UPDATE", objectType: "INDUSTRY", objectId: industry.id, before, after, processName: "industry-update" }, transaction);
    await transaction.commit();
    return res.json({ item: industry });
  } catch (error) {
    await transaction.rollback();
    if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return res.status(409).json({ message: "Industry name already exists" });
    throw error;
  }
}));

industriesRouter.delete("/:id", authorizeCapability("INDUSTRY", ACCESS_ACTIONS.DELETE), asyncHandler(async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const industry = await Industry.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!industry) { await transaction.rollback(); return res.status(404).json({ message: "Industry not found" }); }
    if (industry.industry_code === "IND-PERSONAL") {
      await transaction.rollback();
      return res.status(409).json({ message: "The Personal Industry is reserved by the system and cannot be deleted" });
    }
    const everUsed = await AccountIndustryHistory.count({ where: { industry_id: industry.id }, transaction });
    const currentlyUsed = await Account.count({ where: { industry_id: industry.id }, transaction });
    if (everUsed > 0 || currentlyUsed > 0) {
      await transaction.rollback();
      return res.status(409).json({ message: "Industry has been used by an Account and cannot be deleted" });
    }
    const before = { industry_code: industry.industry_code, name: industry.name, status: industry.status };
    await appendRequestAuditTrail(req, { action: "DELETE", objectType: "INDUSTRY", objectId: industry.id, before, processName: "industry-delete" }, transaction);
    await industry.destroy({ transaction });
    await transaction.commit();
    return res.status(204).end();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}));
