import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { AuditTrailAction } from "@mis/shared-types";
import type { Transaction } from "sequelize";
import { AuditTrail } from "../../database/models";

export type AuditChange = {
  action: AuditTrailAction;
  objectType: string;
  objectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  processName?: string | null;
  ipAddress?: string | null;
  sourceService?: string;
};

const sensitiveKey = /(password|passwd|secret|token|credential|authorization|access.?key)/i;

function assertSafeSnapshot(value: Record<string, unknown> | null | undefined, label: string) {
  if (value == null) return;
  for (const key of Object.keys(value)) {
    if (sensitiveKey.test(key)) throw new TypeError(`Sensitive field cannot be recorded in audit ${label}: ${key}`);
  }
}

function json(value: Record<string, unknown> | null | undefined) {
  return value == null ? null : JSON.stringify(value);
}

function validateActionSnapshots(action: AuditTrailAction, before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  if (action === "CREATE" && (before != null || after == null)) throw new TypeError("CREATE audit requires only an after snapshot");
  if (action === "DELETE" && (before == null || after != null)) throw new TypeError("DELETE audit requires only a before snapshot");
  if ((action === "UPDATE" || action === "SOFT_DELETE") && (before == null || after == null)) {
    throw new TypeError(`${action} audit requires before and after snapshots`);
  }
  if (action === "UPDATE" || action === "SOFT_DELETE") {
    const beforeKeys = Object.keys(before!);
    const afterKeys = Object.keys(after!);
    if (beforeKeys.length === 0 || beforeKeys.length !== afterKeys.length || beforeKeys.some((key) => !Object.hasOwn(after!, key))) {
      throw new TypeError(`${action} snapshots must contain the same non-empty changed field set`);
    }
    if (beforeKeys.every((key) => JSON.stringify(before![key]) === JSON.stringify(after![key]))) {
      throw new TypeError(`${action} snapshots must describe an actual change`);
    }
  }
}

/**
 * Append-only application writer. Call it from the domain service in the same
 * transaction as the business mutation and pass only changed, non-secret fields.
 */
export async function appendAuditTrail(
  change: AuditChange,
  actor: { userId: string; email?: string; activeRole?: string } | null,
  options: { transaction?: Transaction; ipAddress?: string | null } = {},
) {
  validateActionSnapshots(change.action, change.before, change.after);
  assertSafeSnapshot(change.before, "before snapshot");
  assertSafeSnapshot(change.after, "after snapshot");
  if (!actor && !change.processName) throw new TypeError("System audit entries require a processName");
  if (actor && change.processName && !change.processName.trim()) throw new TypeError("processName cannot be empty");

  return AuditTrail.create({
    id: randomUUID(),
    actor_subject: actor?.userId ?? null,
    actor_name: actor?.email ?? actor?.userId ?? change.processName ?? null,
    actor_type: actor ? "USER" : "SYSTEM",
    active_role: actor?.activeRole ?? null,
    process_name: change.processName ?? null,
    action: change.action,
    object_type: change.objectType,
    object_id: change.objectId ?? null,
    ip_address: options.ipAddress ?? change.ipAddress ?? null,
    source_service: change.sourceService ?? "internal-api",
    data_before: json(change.before),
    data_after: json(change.after),
    created_at: new Date(),
  }, { transaction: options.transaction });
}

export function appendRequestAuditTrail(req: Request, change: AuditChange, transaction?: Transaction) {
  if (!req.auth) throw new Error("Validated actor context is required to audit a user action");
  return appendAuditTrail(change, {
    userId: req.auth.userId,
    email: req.auth.email,
    activeRole: req.auth.activeRole,
  }, { transaction, ipAddress: req.header("x-auth-client-ip") ?? null });
}
