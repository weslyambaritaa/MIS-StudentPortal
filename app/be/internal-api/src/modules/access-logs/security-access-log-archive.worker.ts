import { Op, type Transaction } from "sequelize";
import { sequelize } from "../../database/sequelize";
import { SecurityAccessLog, SecurityAccessLogArchive } from "../../database/models";

const ARCHIVE_BATCH_SIZE = 500;
const ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const COPIED_FIELDS = [
  "id", "event_key", "occurred_at", "actor_subject", "actor_type", "active_role", "event_type",
  "object_type", "object_id", "ip_address", "source_system", "outcome", "request_id", "details", "received_at",
] as const;

type ArchiveDependencies = {
  transaction: <T>(callback: (transaction: Transaction) => Promise<T>) => Promise<T>;
  active: typeof SecurityAccessLog;
  archive: typeof SecurityAccessLogArchive;
};

function stableValue(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}

function sameEvent(active: Record<string, unknown>, archived: Record<string, unknown>): boolean {
  return COPIED_FIELDS.every((field) => stableValue(active[field]) === stableValue(archived[field]));
}

export function retentionCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return cutoff;
}

/**
 * Moves one batch inside a single SQL Server transaction. Active rows are deleted
 * only after an identical archive row exists. A conflicting archive key aborts
 * the whole transaction instead of losing or silently replacing evidence.
 */
export async function archiveExpiredSecurityAccessLogBatch(
  cutoff = retentionCutoff(),
  dependencies: ArchiveDependencies = { transaction: (callback) => sequelize.transaction(callback), active: SecurityAccessLog, archive: SecurityAccessLogArchive },
  batchSize = ARCHIVE_BATCH_SIZE,
): Promise<number> {
  return dependencies.transaction(async (transaction) => {
    const activeRows = await dependencies.active.findAll({
      where: { occurred_at: { [Op.lt]: cutoff } },
      order: [["occurred_at", "ASC"], ["id", "ASC"]],
      limit: batchSize,
      transaction,
    });
    if (activeRows.length === 0) return 0;

    for (const row of activeRows) {
      const values = row.get({ plain: true }) as unknown as Record<string, unknown>;
      const existing = await dependencies.archive.findOne({ where: { event_key: values.event_key }, transaction });
      if (existing) {
        const archivedValues = existing.get({ plain: true }) as unknown as Record<string, unknown>;
        if (!sameEvent(values, archivedValues)) {
          throw new Error(`Archive event key conflict for ${String(values.event_key)}`);
        }
      } else {
        await dependencies.archive.create({ ...values, archived_at: new Date() }, { transaction });
      }
    }

    for (const row of activeRows) await row.destroy({ transaction });
    return activeRows.length;
  });
}

export async function archiveExpiredSecurityAccessLogs(now = new Date()): Promise<number> {
  const cutoff = retentionCutoff(now);
  let moved = 0;
  while (true) {
    const count = await archiveExpiredSecurityAccessLogBatch(cutoff);
    moved += count;
    if (count < ARCHIVE_BATCH_SIZE) return moved;
  }
}

export function startSecurityAccessLogArchiveWorker(): () => void {
  const run = () => {
    void archiveExpiredSecurityAccessLogs().then((count) => {
      if (count > 0) console.info(`Archived ${count} expired security access log rows`);
    }).catch((error: unknown) => {
      console.error("Security access log archival failed; active rows were retained for retry", error);
    });
  };
  run();
  const timer = setInterval(run, ARCHIVE_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
