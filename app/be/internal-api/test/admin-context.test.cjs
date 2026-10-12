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

async function withTestServer(handler, run) {
  const app = express();
  app.get("/", handler);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("Internal API accepts only trusted gateway context for MIS account provisioner", async () => {
  await withTestServer(adminContext, async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: {
      "x-gateway-secret": "gateway-test-secret",
      "x-auth-admin-user-id": "operator-123",
      "x-auth-admin-role": "mis-user-provisioner",
    } });
    assert.equal(response.status, 404); // middleware accepted and continued; no handler is registered in this isolated server.
  });
});

test("client-spoofed administrative headers are insufficient without gateway secret", async () => {
  await withTestServer(adminContext, async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: {
      "x-auth-admin-user-id": "attacker",
      "x-auth-admin-role": "mis-user-provisioner",
    } });
    assert.equal(response.status, 401);
  });
});

test("unknown administrative roles are denied", async () => {
  await withTestServer(adminContext, async (baseUrl) => {
    const response = await fetch(baseUrl, { headers: {
      "x-gateway-secret": "gateway-test-secret",
      "x-auth-admin-user-id": "operator-123",
      "x-auth-admin-role": "admin",
    } });
    assert.equal(response.status, 403);
  });
});
