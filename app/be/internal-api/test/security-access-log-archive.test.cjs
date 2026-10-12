const assert = require("node:assert/strict");
const test = require("node:test");

const { archiveExpiredSecurityAccessLogBatch, retentionCutoff } = require("../dist/modules/access-logs/security-access-log-archive.worker.js");
const migration = require("../migrations/202610020002-create-security-access-log-archive.cjs");

function row(values, onDestroy) {
  return {
    get: () => values,
    destroy: async () => { onDestroy(); },
  };
}

test("retention cutoff is one calendar year before the supplied UTC date", () => {
  assert.equal(retentionCutoff(new Date("2026-10-02T12:00:00.000Z")).toISOString(), "2025-10-02T12:00:00.000Z");
});

test("expired events are copied and verified before active rows are deleted", async () => {
  const event = {
    id: "id-1", event_key: "evt-1", occurred_at: new Date("2024-01-01T00:00:00.000Z"),
    actor_subject: "subject-1", actor_type: "USER", active_role: "sales", event_type: "LOGIN",
    object_type: null, object_id: null, ip_address: "127.0.0.1", source_system: "KEYCLOAK",
    outcome: "SUCCESS", request_id: null, details: null, received_at: new Date("2024-01-01T00:00:01.000Z"),
  };
  let deleted = 0;
  let archived;
  const dependencies = {
    transaction: async (callback) => callback({}),
    active: { findAll: async () => [row(event, () => deleted++)] },
    archive: {
      findOne: async () => null,
      create: async (values) => { archived = values; return values; },
    },
  };
  const moved = await archiveExpiredSecurityAccessLogBatch(new Date("2025-01-01T00:00:00.000Z"), dependencies, 10);
  assert.equal(moved, 1);
  assert.equal(archived.event_key, "evt-1");
  assert.ok(archived.archived_at instanceof Date);
  assert.equal(deleted, 1);
});

test("failed archive write retains active evidence", async () => {
  let deleted = 0;
  const event = { id: "id-1", event_key: "evt-1" };
  const dependencies = {
    transaction: async (callback) => callback({}),
    active: { findAll: async () => [row(event, () => deleted++)] },
    archive: { findOne: async () => null, create: async () => { throw new Error("archive unavailable"); } },
  };
  await assert.rejects(archiveExpiredSecurityAccessLogBatch(new Date(), dependencies, 10), /archive unavailable/);
  assert.equal(deleted, 0);
});

test("archive key conflicts retain active evidence and migration rollback refuses to drop archive", async () => {
  let deleted = 0;
  const event = { id: "id-1", event_key: "evt-1", occurred_at: new Date("2024-01-01T00:00:00.000Z") };
  const dependencies = {
    transaction: async (callback) => callback({}),
    active: { findAll: async () => [row(event, () => deleted++)] },
    archive: {
      findOne: async () => ({ get: () => ({ ...event, occurred_at: new Date("2023-01-01T00:00:00.000Z") }) }),
      create: async () => assert.fail("conflicting evidence must not be overwritten"),
    },
  };
  await assert.rejects(archiveExpiredSecurityAccessLogBatch(new Date(), dependencies, 10), /Archive event key conflict/);
  assert.equal(deleted, 0);
  await assert.rejects(migration.down({ dropTable: async () => assert.fail("must not drop archive evidence") }), /Refusing to drop security_access_log_archive/);
});
