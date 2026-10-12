import { randomUUID } from "node:crypto";
import type { ActiveRoleAuthContext, AuditTrailAction, AuditTrailEventEnvelope } from "@mis/shared-types";
import type { Transaction } from "sequelize";
import { AuditOutbox } from "../../database/models/audit-outbox.model";

export async function enqueueAuditEvent(
  actor: ActiveRoleAuthContext,
  event: Omit<AuditTrailEventEnvelope["event"], "eventId" | "sourceService"> & { sourceService?: string },
  transaction: Transaction,
) {
  const eventId = randomUUID();
  return AuditOutbox.create({
    event_id: eventId,
    payload: {
      actor,
      event: {
        ...event,
        eventId,
        sourceService: event.sourceService ?? "student-api",
      },
    },
    attempts: 0,
    next_attempt_at: new Date(),
    created_at: new Date(),
  }, { transaction });
}

export type StudentAuditChange = {
  action: AuditTrailAction;
  objectType: string;
  objectId: string | null;
  dataBefore: Record<string, unknown> | null;
  dataAfter: Record<string, unknown> | null;
  ipAddress: string | null;
  processName?: string | null;
};
