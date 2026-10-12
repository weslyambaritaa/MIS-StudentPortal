const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "student-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";
process.env.INTERNAL_API_URL ??= "http://internal-api:4002";

const { AuditOutbox } = require("../dist/database/models/audit-outbox.model.js");
const client = require("../dist/integrations/internal-api/internal-api.client.js");
const { deliverPendingAuditEvents } = require("../dist/modules/audit-trail/audit-outbox.worker.js");

test("Student audit outbox delivers the trusted actor envelope and removes only after acknowledgement", async () => {
  const oldFindAll = AuditOutbox.findAll;
  const oldRequest = client.requestInternalApi;
  let destroyed = false;
  let request;
  const row = {
    event_id: "event-1", attempts: 0,
    payload: { actor: { userId: "student-sub", roles: ["student"], activeRole: "student" }, event: { eventId: "event-1", action: "CREATE" } },
    destroy: async () => { destroyed = true; },
    update: async () => assert.fail("successful delivery must not schedule retry"),
  };
  AuditOutbox.findAll = async () => [row];
  client.requestInternalApi = async (...args) => { request = args; };
  try {
    assert.equal(await deliverPendingAuditEvents(), 1);
    assert.equal(request[0], "/api/v1/internal-service/audit-trail/events");
    assert.equal(request[1].userId, "student-sub");
    assert.equal(request[2].method, "POST");
    assert.equal(destroyed, true);
  } finally { AuditOutbox.findAll = oldFindAll; client.requestInternalApi = oldRequest; }
});

test("Student audit outbox retains failed events and schedules exponential retry", async () => {
  const oldFindAll = AuditOutbox.findAll;
  const oldRequest = client.requestInternalApi;
  let update;
  const row = {
    event_id: "event-2", attempts: 1,
    payload: { actor: { userId: "student-sub", roles: ["student"], activeRole: "student" }, event: { eventId: "event-2", action: "CREATE" } },
    destroy: async () => assert.fail("failed delivery must retain outbox record"),
    update: async (values) => { update = values; },
  };
  AuditOutbox.findAll = async () => [row];
  client.requestInternalApi = async () => { throw new Error("Internal API offline"); };
  try {
    assert.equal(await deliverPendingAuditEvents(new Date("2026-10-05T00:00:00.000Z")), 0);
    assert.equal(update.attempts, 2);
    assert.equal(update.next_attempt_at.toISOString(), "2026-10-05T00:00:04.000Z");
  } finally { AuditOutbox.findAll = oldFindAll; client.requestInternalApi = oldRequest; }
});
