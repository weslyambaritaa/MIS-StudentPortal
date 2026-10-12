import type { ActiveRoleAuthContext } from "./auth";

export const AUDIT_TRAIL_ACTIONS = ["CREATE", "UPDATE", "SOFT_DELETE", "DELETE"] as const;
export type AuditTrailAction = (typeof AUDIT_TRAIL_ACTIONS)[number];

export type AuditTrailEvent = {
  eventId: string;
  action: AuditTrailAction;
  objectType: string;
  objectId: string | null;
  dataBefore: Record<string, unknown> | null;
  dataAfter: Record<string, unknown> | null;
  ipAddress: string | null;
  sourceService: string;
  processName?: string | null;
};

export type AuditTrailEventEnvelope = {
  actor: ActiveRoleAuthContext;
  event: AuditTrailEvent;
};

export function isAuditTrailAction(value: unknown): value is AuditTrailAction {
  return typeof value === "string" && (AUDIT_TRAIL_ACTIONS as readonly string[]).includes(value);
}
