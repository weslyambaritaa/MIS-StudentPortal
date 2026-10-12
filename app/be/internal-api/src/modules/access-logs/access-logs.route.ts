import { Op, type FindAndCountOptions, type WhereOptions } from "sequelize";
import { Router } from "express";
import { SecurityAccessLog, SecurityAccessLogArchive } from "../../database/models";
import { asyncHandler } from "../../utils/async-handler";

export const accessLogsRouter = Router();

function positiveInteger(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  // Prevent spreadsheet formula execution when exported data is opened in office software.
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: Array<Record<string, unknown>>): string {
  const columns = [
    "id", "occurred_at", "actor_subject", "actor_type", "active_role", "event_type",
    "object_type", "object_id", "ip_address", "source_system", "outcome", "request_id", "details",
  ] as const;
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\r\n");
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

accessLogsRouter.get("/", asyncHandler(async (req, res) => {
  const page = positiveInteger(req.query.page, 1, 1_000_000);
  const pageSize = positiveInteger(req.query.pageSize, 25, 100);
  if (page === null || pageSize === null) {
    return res.status(400).json({ message: "Invalid pagination; pageSize must be between 1 and 100" });
  }

  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from === null || to === null || (from && to && from > to)) {
    return res.status(400).json({ message: "Invalid date range" });
  }
  const eventType = req.query.eventType;
  const actorSubject = req.query.actorSubject;
  const outcome = req.query.outcome;
  const storageValue = req.query.storage ?? "active";
  if (eventType !== undefined && (typeof eventType !== "string" || eventType.length > 100)) {
    return res.status(400).json({ message: "Invalid eventType filter" });
  }
  if (actorSubject !== undefined && (typeof actorSubject !== "string" || actorSubject.length > 255)) {
    return res.status(400).json({ message: "Invalid actorSubject filter" });
  }
  if (outcome !== undefined && (typeof outcome !== "string" || !["SUCCESS", "FAILURE", "UNKNOWN"].includes(outcome))) {
    return res.status(400).json({ message: "Invalid outcome filter" });
  }
  if (typeof storageValue !== "string" || !["active", "archive"].includes(storageValue)) {
    return res.status(400).json({ message: "storage must be active or archive" });
  }

  const where: WhereOptions = {};
  if (eventType) where.event_type = eventType;
  if (actorSubject) where.actor_subject = actorSubject;
  if (outcome) where.outcome = outcome;
  if (from || to) {
    where.occurred_at = {
      ...(from ? { [Op.gte]: from } : {}),
      ...(to ? { [Op.lte]: to } : {}),
    };
  }

  const exportCsv = req.query.format === "csv";
  if (req.query.format !== undefined && !exportCsv) return res.status(400).json({ message: "format must be csv" });
  if (exportCsv && from && to && to.getTime() - from.getTime() > 31 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: "CSV export date range cannot exceed 31 days" });
  }

  const query: FindAndCountOptions = {
    where,
    order: [["occurred_at", "DESC"], ["id", "DESC"]],
    limit: exportCsv ? 10_001 : pageSize,
    offset: exportCsv ? 0 : (page - 1) * pageSize,
  };
  const result = storageValue === "archive"
    ? await SecurityAccessLogArchive.findAndCountAll(query)
    : await SecurityAccessLog.findAndCountAll(query);
  const rows = result.rows.map((instance) => instance.get({ plain: true }) as unknown as Record<string, unknown>);

  if (exportCsv) {
    if (rows.length > 10_000) {
      return res.status(413).json({ message: "CSV export exceeds 10,000 rows; narrow the filters" });
    }
    const content = csv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="access-logs.csv"');
    res.setHeader("Cache-Control", "no-store");
    return res.send(content);
  }
  return res.json({
    items: rows,
    page,
    pageSize,
    total: result.count,
    totalPages: Math.ceil(result.count / pageSize),
  });
}));
