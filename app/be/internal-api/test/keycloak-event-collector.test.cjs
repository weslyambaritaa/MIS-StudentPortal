const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.KEYCLOAK_AUDIT_ENABLED = "true";
process.env.KEYCLOAK_AUDIT_CLIENT_SECRET = "collector-test-secret";

const { collectKeycloakAccessEvents } = require("../dist/modules/access-logs/keycloak-event-collector.worker.js");
const { KeycloakEventSyncCheckpoint, SecurityAccessLog } = require("../dist/database/models/index.js");
const { sequelize } = require("../dist/database/sequelize.js");

test("collector imports normalized user and admin events without raw representations", async () => {
  const originalFetch = global.fetch;
  const originalFindByPk = KeycloakEventSyncCheckpoint.findByPk;
  const originalCreate = KeycloakEventSyncCheckpoint.create;
  const originalFindOrCreate = SecurityAccessLog.findOrCreate;
  const originalTransaction = sequelize.transaction;
  const calls = [];
  const inserts = [];
  const checkpointRows = [];
  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname.endsWith("/protocol/openid-connect/token")) {
      return new Response(JSON.stringify({ access_token: "not-persisted" }), { status: 200 });
    }
    if (url.pathname.endsWith("/events")) {
      return new Response(JSON.stringify([{
        time: 1790900000000, type: "LOGIN", realmId: "realm-id", clientId: "frontend",
        userId: "student-sub", sessionId: "session-1", ipAddress: "192.0.2.1", details: { username: "student" },
      }]), { status: 200 });
    }
    if (url.pathname.endsWith("/admin-events")) {
      return new Response(JSON.stringify([{
        time: 1790900001000, operationType: "UPDATE", resourceType: "USER", resourcePath: "users/target-sub",
        authDetails: { userId: "operator-sub", ipAddress: "192.0.2.2" }, representation: "{password:secret}",
      }]), { status: 200 });
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  KeycloakEventSyncCheckpoint.findByPk = async () => null;
  KeycloakEventSyncCheckpoint.create = async (values) => { checkpointRows.push(values); return values; };
  SecurityAccessLog.findOrCreate = async (values) => { inserts.push(values.defaults); return [values.defaults, true]; };
  sequelize.transaction = async (callback) => callback({});
  try {
    const count = await collectKeycloakAccessEvents(new Date("2026-10-02T00:00:00Z"));
    assert.equal(count, 2);
    assert.equal(inserts.length, 2);
    assert.equal(inserts[0].event_type, "LOGIN");
    assert.equal(inserts[0].actor_subject, "student-sub");
    assert.equal(inserts[0].ip_address, "192.0.2.1");
    assert.equal(inserts[0].source_system, "KEYCLOAK_USER");
    assert.equal(inserts[1].actor_subject, "operator-sub");
    assert.equal(inserts[1].object_id, "target-sub");
    assert.equal(inserts[1].source_system, "KEYCLOAK_ADMIN");
    assert.equal(inserts[1].details.includes("password"), false);
    assert.equal(inserts[1].details.includes("secret"), false);
    assert.equal(checkpointRows.length, 2);
    assert.ok(calls[0].init.body.toString().includes("grant_type=client_credentials"));
    assert.equal(JSON.stringify(inserts).includes("not-persisted"), false);
  } finally {
    global.fetch = originalFetch;
    KeycloakEventSyncCheckpoint.findByPk = originalFindByPk;
    KeycloakEventSyncCheckpoint.create = originalCreate;
    SecurityAccessLog.findOrCreate = originalFindOrCreate;
    sequelize.transaction = originalTransaction;
  }
});
