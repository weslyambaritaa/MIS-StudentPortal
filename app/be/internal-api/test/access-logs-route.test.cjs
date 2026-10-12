const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";

const express = require("express");
const { adminContext } = require("../dist/middlewares/admin-context.middleware.js");
const { accessLogsRouter } = require("../dist/modules/access-logs/access-logs.route.js");
const { SecurityAccessLog } = require("../dist/database/models/index.js");
const { SecurityAccessLogArchive } = require("../dist/database/models/index.js");

async function withServer(run) {
  const app = express();
  app.use("/logs", adminContext, accessLogsRouter);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("access log list requires trusted admin and applies allowlisted filters", async () => {
  const oldFind = SecurityAccessLog.findAndCountAll;
  let query;
  SecurityAccessLog.findAndCountAll = async (value) => {
    query = value;
    return { count: 1, rows: [{ get: () => ({ id: "1", event_type: "LOGIN", occurred_at: new Date("2026-10-01T00:00:00Z") }) }] };
  };
  try {
    await withServer(async (baseUrl) => {
      const denied = await fetch(`${baseUrl}/logs`);
      assert.equal(denied.status, 401);

      const response = await fetch(`${baseUrl}/logs?eventType=LOGIN&outcome=SUCCESS&from=2026-10-01T00%3A00%3A00Z&page=1&pageSize=10`, {
        headers: {
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.total, 1);
      assert.equal(body.items[0].event_type, "LOGIN");
      assert.equal(query.where.event_type, "LOGIN");
      assert.equal(query.where.outcome, "SUCCESS");
      assert.equal(query.limit, 10);
    });
  } finally {
    SecurityAccessLog.findAndCountAll = oldFind;
  }
});

test("access log export is CSV, paginated, and protects spreadsheet formula values", async () => {
  const oldFind = SecurityAccessLog.findAndCountAll;
  SecurityAccessLog.findAndCountAll = async () => ({
    count: 1,
    rows: [{ get: () => ({ id: "1", actor_subject: "=HYPERLINK(\"https://bad\")", event_type: "LOGIN", occurred_at: new Date("2026-10-01T00:00:00Z") }) }],
  });
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/logs?format=csv`, {
        headers: {
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/csv/);
      const body = await response.text();
      assert.match(body.split("\r\n")[0], /occurred_at,actor_subject/);
      assert.match(body, /"'=HYPERLINK/);
      const remove = await fetch(`${baseUrl}/logs`, {
        method: "DELETE",
        headers: {
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
      });
      assert.equal(remove.status, 404); // no delete endpoint exists.
    });
  } finally {
    SecurityAccessLog.findAndCountAll = oldFind;
  }
});

test("archived logs are explicitly queryable through the same read-only endpoint", async () => {
  const oldFind = SecurityAccessLogArchive.findAndCountAll;
  let query;
  SecurityAccessLogArchive.findAndCountAll = async (value) => {
    query = value;
    return { count: 0, rows: [] };
  };
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/logs?storage=archive&eventType=LOGIN`, {
        headers: {
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
      });
      assert.equal(response.status, 200);
      assert.equal(query.where.event_type, "LOGIN");
      assert.equal(query.limit, 25);
    });
  } finally {
    SecurityAccessLogArchive.findAndCountAll = oldFind;
  }
});
