import { Op } from "sequelize";
import { Router } from "express";
import { isBusinessRole, ROLES, isAuditTrailAction, type AuditTrailEvent } from "@mis/shared-types";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { AuditTrail, AuditTrailArchive } from "../../database/models";

export const auditTrailRouter = Router();
export const auditTrailIngestionRouter = Router();

function positiveInteger(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

function dateFilter(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasSensitiveKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) =>
    /(password|passwd|secret|token|credential|authorization|access.?key)/i.test(key) || hasSensitiveKey(nested));
}

function sensitiveSnapshot(value: unknown): value is Record<string, unknown> | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return !hasSensitiveKey(value);
}

function validSnapshots(action: unknown, before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (action === "CREATE") return before === null && after !== null;
  if (action === "DELETE") return before !== null && after === null;
  if (action === "UPDATE" || action === "SOFT_DELETE") {
    const beforeKeys = before ? Object.keys(before) : [];
    const afterKeys = after ? Object.keys(after) : [];
    return beforeKeys.length > 0 && beforeKeys.length === afterKeys.length && beforeKeys.every((key) => Object.hasOwn(after!, key)) &&
      beforeKeys.some((key) => JSON.stringify(before![key]) !== JSON.stringify(after![key]));
  }
  return false;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Student API uses this authenticated service-only endpoint to deliver outbox events. */
auditTrailIngestionRouter.post("/", asyncHandler(async (req, res) => {
  const actor = req.auth;
  if (!actor) return res.status(401).json({ message: "Validated service actor context is required" });
  const body = req.body as Partial<AuditTrailEvent> | null;
  if (!body || !isUuid(body.eventId) || !isAuditTrailAction(body.action) ||
      typeof body.objectType !== "string" || !body.objectType.trim() || body.objectType.length > 50 ||
      (body.objectId !== null && body.objectId !== undefined && (typeof body.objectId !== "string" || body.objectId.length > 100)) ||
      !sensitiveSnapshot(body.dataBefore) || !sensitiveSnapshot(body.dataAfter) ||
      typeof body.sourceService !== "string" || body.sourceService.length > 50 ||
      body.sourceService !== "student-api" ||
      !validSnapshots(body.action, body.dataBefore as Record<string, unknown> | null, body.dataAfter as Record<string, unknown> | null) ||
      (body.processName != null && (typeof body.processName !== "string" || body.processName.length > 128)) ||
      (body.ipAddress != null && (typeof body.ipAddress !== "string" || body.ipAddress.length > 45))) {
    return res.status(400).json({ message: "Invalid audit event payload" });
  }

  const [entry, created] = await AuditTrail.findOrCreate({
    where: { id: body.eventId },
    defaults: {
      id: body.eventId,
      actor_subject: actor.userId,
      actor_name: actor.email ?? actor.userId,
      actor_type: "USER",
      active_role: actor.activeRole,
      process_name: body.processName ?? null,
      action: body.action,
      object_type: body.objectType.trim(),
      object_id: body.objectId ?? null,
      ip_address: body.ipAddress ?? null,
      source_service: body.sourceService,
      data_before: body.dataBefore == null ? null : JSON.stringify(body.dataBefore),
      data_after: body.dataAfter == null ? null : JSON.stringify(body.dataAfter),
      created_at: new Date(),
    },
  });
  return res.status(created ? 201 : 200).json({ eventId: entry.id, recorded: true });
}));

/** Admin QPD can review business changes made by all roles; no mutation routes are exposed. */
auditTrailRouter.get("/", authorizeActiveRole(ROLES.ADMIN), asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, 100_000);
  const pageSize = positiveInteger(req.query.pageSize, 8, 100);
  if (!page || !pageSize) return res.status(400).json({ message: "Invalid pagination" });

  const role = req.query.role;
  if (role !== undefined && (typeof role !== "string" || !isBusinessRole(role))) {
    return res.status(400).json({ message: "Unknown business role filter" });
  }
  const from = dateFilter(req.query.from);
  const to = dateFilter(req.query.to);
  if (from === null || to === null || (from && to && from > to)) {
    return res.status(400).json({ message: "Invalid date/time filter" });
  }

  const where = {
    ...(role ? { active_role: role } : {}),
    ...(from || to ? { created_at: { ...(from ? { [Op.gte]: from } : {}), ...(to ? { [Op.lte]: to } : {}) } } : {}),
  };
  const offset = (page - 1) * pageSize;
  const queryOptions = { where, order: [["created_at", "DESC"], ["id", "DESC"]] as Array<[string, "DESC"]>, limit: offset + pageSize };
  const [activeCount, archivedCount, activeRows, archivedRows] = await Promise.all([
    AuditTrail.count({ where }),
    AuditTrailArchive.count({ where }),
    AuditTrail.findAll(queryOptions),
    AuditTrailArchive.findAll(queryOptions),
  ]);
  const merged = [
    ...activeRows.map((entry) => ({ ...entry.get({ plain: true }), storage: "active" })),
    ...archivedRows.map((entry) => ({ ...entry.get({ plain: true }), storage: "archive" })),
  ].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime() || String(right.id).localeCompare(String(left.id)));
  const items = merged.slice(offset, offset + pageSize);
  return res.json({ items, page, pageSize, total: activeCount + archivedCount });
}));
