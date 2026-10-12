const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

process.env.NODE_ENV = "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";

const { AuditTrail } = require("../dist/database/models/index.js");
const { errorHandler } = require("../dist/middlewares/error-handler.middleware.js");
const { adminContext } = require("../dist/middlewares/admin-context.middleware.js");
const { accountProvisioningRouter } = require("../dist/modules/accounts/account-provisioning.route.js");
const { keycloakAccountProvisioner } = require("../dist/modules/accounts/keycloak-account-provisioner.js");

async function withAccountApp(run) {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/admin/accounts", adminContext, accountProvisioningRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("MIS account endpoint denies forged actor context and accepts only trusted admin headers", async () => {
  await withAccountApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/accounts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-auth-admin-role": "mis-user-provisioner" },
      body: JSON.stringify({ username: "new-user", role: "student" }),
    });
    assert.equal(response.status, 401);
  });
});

test("MIS account endpoint validates role before calling Keycloak", async () => {
  const oldCreate = keycloakAccountProvisioner.createAccount;
  let called = false;
  keycloakAccountProvisioner.createAccount = async () => { called = true; throw new Error("unexpected"); };
  try {
    await withAccountApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/accounts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
        body: JSON.stringify({ username: "new-user", role: "master_admin" }),
      });
      assert.equal(response.status, 400);
    });
    assert.equal(called, false);
  } finally {
    keycloakAccountProvisioner.createAccount = oldCreate;
  }
});

test("MIS account endpoint accepts valid role/status filters and pagination for the account list", async () => {
  const oldList = keycloakAccountProvisioner.listAccounts;
  let input;
  keycloakAccountProvisioner.listAccounts = async (value) => {
    input = value;
    return { accounts: [], page: value.page, pageSize: value.pageSize, total: 0, totalPages: 0 };
  };
  try {
    await withAccountApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/accounts?role=sales&status=disabled&page=2&pageSize=10`, {
        headers: {
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { accounts: [], page: 2, pageSize: 10, total: 0, totalPages: 0 });
    });
    assert.deepEqual(input, { role: "sales", status: "disabled", page: 2, pageSize: 10 });
  } finally {
    keycloakAccountProvisioner.listAccounts = oldList;
  }
});

test("MIS account endpoint rejects arbitrary role, status, and unsafe pagination filters", async () => {
  const oldList = keycloakAccountProvisioner.listAccounts;
  let called = false;
  keycloakAccountProvisioner.listAccounts = async () => { called = true; throw new Error("unexpected"); };
  try {
    await withAccountApp(async (baseUrl) => {
      const headers = {
        "x-gateway-secret": "gateway-test-secret",
        "x-auth-admin-user-id": "operator-1",
        "x-auth-admin-role": "mis-user-provisioner",
      };
      for (const query of ["role=super_admin", "status=unknown", "page=0", "pageSize=1000"]) {
        const response = await fetch(`${baseUrl}/api/v1/admin/accounts?${query}`, { headers });
        assert.equal(response.status, 400, query);
      }
    });
    assert.equal(called, false);
  } finally {
    keycloakAccountProvisioner.listAccounts = oldList;
  }
});

test("MIS account provisioning does not duplicate identity/access events in business Audit Trail", async () => {
  const oldProvision = keycloakAccountProvisioner.createAccount;
  const oldAudit = AuditTrail.create;
  let audit;
  keycloakAccountProvisioner.createAccount = async (input) => ({
    userId: "kc-user-1", username: input.username, email: input.email,
    role: input.role, enabled: true, source: "AUTOMATIC",
  });
  AuditTrail.create = async (values) => { audit = values; return values; };
  try {
    await withAccountApp(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/admin/accounts`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-admin-user-id": "operator-1",
          "x-auth-admin-role": "mis-user-provisioner",
        },
        body: JSON.stringify({ username: "new-user", email: "new@example.test", role: "student" }),
      });
      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.account.userId, "kc-user-1");
      assert.equal(body.account.source, "AUTOMATIC");
      assert.equal("password" in body.account, false);
    });
    assert.equal(audit, undefined);
  } finally {
    keycloakAccountProvisioner.createAccount = oldProvision;
    AuditTrail.create = oldAudit;
  }
});
