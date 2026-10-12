const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET = "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET = "service-test-secret";

const { app } = require("../dist/app.js");
const { AuditTrail } = require("../dist/database/models/index.js");
const { sequelize } = require("../dist/database/sequelize.js");
const { appendAuditTrail } = require("../dist/modules/audit-trail/audit-trail.service.js");
const { archiveAuditTrailBatch, auditTrailCutoff } = require("../dist/modules/audit-trail/audit-trail-archive.worker.js");

async function withServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("audit writer records trusted actor, role, IP and only supplied changed fields", async () => {
  const originalCreate = AuditTrail.create;
  let values;
  AuditTrail.create = async (input) => { values = input; return input; };
  try {
    await appendAuditTrail({
      action: "UPDATE", objectType: "TRAINING", objectId: "training-1",
      before: { status: "DRAFT" }, after: { status: "PUBLISHED" },
    }, { userId: "kc-admin-1", email: "admin@example.test", activeRole: "admin" }, { ipAddress: "192.0.2.2" });
    assert.equal(values.actor_subject, "kc-admin-1");
    assert.equal(values.active_role, "admin");
    assert.equal(values.ip_address, "192.0.2.2");
    assert.deepEqual(JSON.parse(values.data_before), { status: "DRAFT" });
    assert.deepEqual(JSON.parse(values.data_after), { status: "PUBLISHED" });
  } finally { AuditTrail.create = originalCreate; }
});

test("audit writer refuses credentials and requires a process for system actions", async () => {
  await assert.rejects(appendAuditTrail({ action: "UPDATE", objectType: "USER", before: { nested: { password: "secret" } } }, { userId: "actor" }));
  await assert.rejects(appendAuditTrail({ action: "CREATE", objectType: "IMPORT_BATCH", after: { id: "batch" } }, null), /processName/);
});

test("Audit Trail list joins active and archived records, filters by role/time, and only active admin can view", async () => {
  const originalQuery = sequelize.query;
  const calls = [];
  sequelize.query = async (sql, options) => {
    calls.push({ sql, replacements: options.replacements });
    return sql.includes("COUNT_BIG") ? [{ total: 1 }] : [{ id: "entry-1", action: "UPDATE", storage: "active" }];
  };
  try {
    await withServer(async (base) => {
      const headers = {
        "x-gateway-secret": "gateway-test-secret",
        "x-auth-user-id": "admin-sub",
        "x-auth-user-roles": "admin,sales",
        "x-auth-active-role": "admin",
      };
      const response = await fetch(`${base}/api/v1/internal/audit-trail?role=sales&from=2026-01-01T00%3A00%3A00.000Z&page=1`, { headers });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.total, 1);
      assert.equal(body.items[0].storage, "active");
      assert.match(calls[0].sql, /UNION ALL/);
      assert.equal(calls[0].replacements.role, "sales");

      const wrongRole = await fetch(`${base}/api/v1/internal/audit-trail`, {
        headers: { ...headers, "x-auth-active-role": "sales" },
      });
      assert.equal(wrongRole.status, 403);

      const deletion = await fetch(`${base}/api/v1/internal/audit-trail`, { method: "DELETE", headers });
      assert.equal(deletion.status, 404);
    });
  } finally { sequelize.query = originalQuery; }
});

test("Student service event ingestion takes actor from trusted S2S headers and is idempotent", async () => {
  const originalFindOrCreate = AuditTrail.findOrCreate;
  const stored = [];
  AuditTrail.findOrCreate = async (options) => {
    stored.push(options.defaults);
    return [{ id: options.defaults.id }, stored.length === 1];
  };
  try {
    await withServer(async (base) => {
      const event = {
        eventId: "7638bbd8-2ff7-43ad-86c0-1c642d7c4277",
        action: "CREATE",
        objectType: "STUDENT_PROFILE",
        objectId: "student-1",
        dataBefore: null,
        dataAfter: { student_id: "student-1" },
        ipAddress: "192.0.2.10",
        sourceService: "student-api",
        actor_subject: "untrusted-body-actor",
      };
      const headers = {
        "content-type": "application/json",
        "x-service-secret": "service-test-secret",
        "x-actor-user-id": "trusted-student-sub",
        "x-actor-user-email": "student@example.test",
        "x-actor-roles": "student",
        "x-actor-active-role": "student",
      };
      const first = await fetch(`${base}/api/v1/internal-service/audit-trail/events`, { method: "POST", headers, body: JSON.stringify(event) });
      const replay = await fetch(`${base}/api/v1/internal-service/audit-trail/events`, { method: "POST", headers, body: JSON.stringify(event) });
      assert.equal(first.status, 201);
      assert.equal(replay.status, 200);
      assert.equal(stored[0].actor_subject, "trusted-student-sub");
      assert.equal(stored[0].active_role, "student");
      assert.equal(stored[0].ip_address, "192.0.2.10");

      const invalid = await fetch(`${base}/api/v1/internal-service/audit-trail/events`, {
        method: "POST", headers,
        body: JSON.stringify({ ...event, eventId: "7638bbd8-2ff7-43ad-86c0-1c642d7c4278", dataAfter: { nested: { password: "secret" } } }),
      });
      assert.equal(invalid.status, 400);
    });
  } finally { AuditTrail.findOrCreate = originalFindOrCreate; }
});

test("Audit Trail 12-month archival copies and verifies records before deleting active rows", async () => {
  assert.equal(auditTrailCutoff(new Date("2026-10-05T00:00:00.000Z")).toISOString(), "2025-10-05T00:00:00.000Z");
  const record = {
    id: "entry-1", action: "DELETE", object_type: "COURSE", object_id: "course-1",
    created_at: new Date("2024-01-01T00:00:00.000Z"), actor_subject: "actor", data_before: "{}", data_after: null,
    get() { return { ...this }; }, destroy() { this.deleted = true; },
  };
  let archived;
  let deleted = false;
  const dependencies = {
    transaction: async (callback) => callback({}),
    active: { findAll: async () => [{ ...record, destroy: async () => { deleted = true; } }] },
    archive: {
      findByPk: async () => null,
      create: async (values) => { archived = values; return values; },
    },
  };
  const moved = await archiveAuditTrailBatch(new Date("2025-01-01T00:00:00.000Z"), dependencies, 10);
  assert.equal(moved, 1);
  assert.equal(archived.id, "entry-1");
  assert.ok(archived.archived_at instanceof Date);
  assert.equal(deleted, true);
});
