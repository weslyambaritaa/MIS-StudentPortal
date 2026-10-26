import { Op } from "sequelize";
import type { AuditTrailEventEnvelope } from "@mis/shared-types";
import { AuditOutbox } from "../../database/models/audit-outbox.model";
import { requestInternalApi } from "../../integrations/internal-api/internal-api.client";
import { backgroundFailure } from "../../monitoring";

const DELIVERY_INTERVAL_MS = 10_000;
const BATCH_SIZE = 25;
const MAX_BACKOFF_MS = 5 * 60_000;

export async function deliverPendingAuditEvents(now = new Date()) {
  const pending = await AuditOutbox.findAll({
    where: { next_attempt_at: { [Op.lte]: now } },
    order: [["created_at", "ASC"]],
    limit: BATCH_SIZE,
  });
  let delivered = 0;
  for (const row of pending) {
    const payload = row.payload as unknown as AuditTrailEventEnvelope;
    try {
      await requestInternalApi<void>("/api/v1/internal-service/audit-trail/events", payload.actor, {
        method: "POST",
        body: payload.event,
      });
      await row.destroy();
      delivered += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const backoff = Math.min(MAX_BACKOFF_MS, 1000 * (2 ** Math.min(attempts, 8)));
      await row.update({ attempts, next_attempt_at: new Date(now.getTime() + backoff) });
      backgroundFailure.record("audit-outbox-delivery", error);
    }
  }
  return delivered;
}

export function startAuditOutboxWorker() {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    void deliverPendingAuditEvents().catch((error: unknown) => {
      backgroundFailure.record("audit-outbox-poll", error);
    }).finally(() => { running = false; });
  };
  run();
  const timer = setInterval(run, DELIVERY_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
