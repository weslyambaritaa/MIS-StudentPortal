import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
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
  const rows = await sequelize.query<{ value: number | string | bigint }>(
    "SELECT nextval('industry_code_seq') AS value",
    { type: QueryTypes.SELECT, transaction },
  );
  return codeFor(rows[0].value);
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

  const where: string[] = [];
  const replacements: Record<string, unknown> = { offset: (page - 1) * pageSize, pageSize };
  if (search) {
    where.push("(i.industry_code ILIKE :search OR i.name ILIKE :search)");
    replacements.search = `%${search.replace(/[\[%_]/g, (character) => `[${character}]`)}%`;
  }
  if (status && status !== "ALL") { where.push("i.status = :status"); replacements.status = status; }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await sequelize.query<{ total: number | string }>(
    `SELECT COUNT(1) AS total FROM industry AS i ${clause}`,
    { replacements, type: QueryTypes.SELECT },
  );
  const items = await sequelize.query<Record<string, unknown>>(
    `SELECT i.id, i.industry_code, i.name, i.status, i.created_at, i.updated_at,
            COUNT(a.id) AS amount_account,
            CASE WHEN EXISTS (SELECT 1 FROM account_industry_history h WHERE h.industry_id = i.id)
                 THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS ever_used
       FROM industry AS i
       LEFT JOIN account AS a ON a.industry_id = i.id
       ${clause}
       GROUP BY i.id, i.industry_code, i.name, i.status, i.created_at, i.updated_at
       ORDER BY i.industry_code ASC
       LIMIT :pageSize OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT },
  );
  return res.json({ items, page, pageSize, total: Number(countRows[0]?.total ?? 0) });
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
