import { Op, type Transaction } from "sequelize";
import { sequelize } from "../../database/sequelize";
import { backgroundFailure } from "../monitoring/background-failure";
import { AuditTrail, AuditTrailArchive } from "../../database/models";

const BATCH_SIZE = 500;
const INTERVAL_MS = 24 * 60 * 60 * 1000;
const FIELDS = [
  "id", "actor_subject", "actor_name", "actor_type", "active_role", "process_name", "action",
  "object_type", "object_id", "ip_address", "source_service", "data_before", "data_after", "created_at",
] as const;

type ArchiveDependencies = {
  transaction: <T>(callback: (transaction: Transaction) => Promise<T>) => Promise<T>;
  active: typeof AuditTrail;
  archive: typeof AuditTrailArchive;
};

function valueOf(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return value instanceof Date ? value.toISOString() : value;
}

function identical(active: Record<string, unknown>, archived: Record<string, unknown>) {
  return FIELDS.every((field) => valueOf(active, field) === valueOf(archived, field));
}

export function auditTrailCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return cutoff;
}

/** Copies and verifies each batch transactionally before removing active rows. */
export async function archiveAuditTrailBatch(
  cutoff = auditTrailCutoff(),
  dependencies: ArchiveDependencies = {
    transaction: (callback) => sequelize.transaction(callback),
    active: AuditTrail,
    archive: AuditTrailArchive,
  },
  batchSize = BATCH_SIZE,
) {
  return dependencies.transaction(async (transaction) => {
    const entries = await dependencies.active.findAll({
      where: { created_at: { [Op.lt]: cutoff } },
      order: [["created_at", "ASC"], ["id", "ASC"]],
      limit: batchSize,
      transaction,
    });
    for (const entry of entries) {
      const values = entry.get({ plain: true }) as unknown as Record<string, unknown>;
      const existing = await dependencies.archive.findByPk(String(values.id), { transaction });
      if (existing) {
        const archiveValues = existing.get({ plain: true }) as unknown as Record<string, unknown>;
        if (!identical(values, archiveValues)) throw new Error(`Audit archive conflict for ${String(values.id)}`);
      } else {
        await dependencies.archive.create({ ...values, archived_at: new Date() }, { transaction });
      }
    }
    for (const entry of entries) await entry.destroy({ transaction });
    return entries.length;
  });
}

export async function archiveExpiredAuditTrail(now = new Date()) {
  const cutoff = auditTrailCutoff(now);
  let moved = 0;
  while (true) {
    const count = await archiveAuditTrailBatch(cutoff);
    moved += count;
    if (count < BATCH_SIZE) return moved;
  }
}

export function startAuditTrailArchiveWorker() {
  const run = () => {
    void archiveExpiredAuditTrail().then((count) => {
      backgroundFailure.clear("audit-trail-archive");
      if (count) console.info(`Archived ${count} expired Audit Trail records`);
    }).catch((error: unknown) => {
      backgroundFailure.record("audit-trail-archive", error);
    });
  };
  run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
