const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET = "gateway-test-secret";

const { app } = require("../dist/app.js");
const { sequelize } = require("../dist/database/sequelize.js");
const { Account, AccountIndustryHistory, AuditTrail, Industry, RoleAccessMatrix } = require("../dist/database/models/index.js");

async function withServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function headers(role = "sales") {
  return {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "actor-1",
    "x-auth-user-email": "actor@example.test",
    "x-auth-user-roles": `${role},management`,
    "x-auth-active-role": role,
  };
}

test("Industry listing searches by code/name, includes all Account statuses, and is internal read-only for other roles", async () => {
  const originalQuery = sequelize.query;
  const originalMatrixFindOne = RoleAccessMatrix.findOne;
  const calls = [];
  sequelize.query = async (sql, options) => {
    calls.push({ sql, replacements: options.replacements });
    return sql.includes("COUNT_BIG") ? [{ total: 1 }] : [{ id: "ind-1", industry_code: "IND-01", name: "Energy", amount_account: 5, ever_used: true }];
  };
  RoleAccessMatrix.findOne = async ({ where, attributes }) => ({ [attributes[0]]: attributes[0] === "can_view" || where.role === "sales" });
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/v1/internal/industries?search=Energy&status=ACTIVE&page=1&pageSize=8`, { headers: headers("sales") });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.items[0].amount_account, 5);
      assert.match(calls[1].sql, /LEFT JOIN \[dbo\]\.\[account\]/);
      assert.doesNotMatch(calls[1].sql, /a\.\[status\]/);
      assert.equal(calls[1].replacements.status, "ACTIVE");

      const internalRead = await fetch(`${base}/api/v1/internal/industries`, { headers: headers("management") });
      assert.equal(internalRead.status, 200);
      const externalRole = await fetch(`${base}/api/v1/internal/industries`, { headers: headers("trainer") });
      assert.equal(externalRole.status, 403);
    });
  } finally {
    sequelize.query = originalQuery;
    RoleAccessMatrix.findOne = originalMatrixFindOne;
  }
});

test("read-only internal roles cannot create Industry; Sales creation generates an immutable code and audits it", async () => {
  const originals = {
    matrix: RoleAccessMatrix.findOne,
    query: sequelize.query,
    transaction: sequelize.transaction,
    create: Industry.create,
    audit: AuditTrail.create,
  };
  const grants = [];
  RoleAccessMatrix.findOne = async ({ where, attributes }) => ({ [attributes[0]]: attributes[0] === "can_view" || where.role === "sales" });
  sequelize.query = async () => [{ value: 7 }];
  const transaction = { commit: async () => {}, rollback: async () => {}, LOCK: { UPDATE: "UPDATE" } };
  sequelize.transaction = async () => transaction;
  Industry.create = async (input) => ({ id: input.id, ...input });
  AuditTrail.create = async (input) => { grants.push(input); return input; };
  try {
    await withServer(async (base) => {
      const forbidden = await fetch(`${base}/api/v1/internal/industries`, {
        method: "POST", headers: { ...headers("management"), "content-type": "application/json" },
        body: JSON.stringify({ name: "Energy", status: "ACTIVE" }),
      });
      assert.equal(forbidden.status, 403);

      const created = await fetch(`${base}/api/v1/internal/industries`, {
        method: "POST", headers: { ...headers("sales"), "content-type": "application/json" },
        body: JSON.stringify({ name: "Energy", status: "ACTIVE" }),
      });
      assert.equal(created.status, 201);
      assert.equal((await created.json()).item.industry_code, "IND-07");
      assert.equal(grants[0].action, "CREATE");
      assert.equal(grants[0].actor_subject, "actor-1");
    });
  } finally {
    RoleAccessMatrix.findOne = originals.matrix;
    sequelize.query = originals.query;
    sequelize.transaction = originals.transaction;
    Industry.create = originals.create;
    AuditTrail.create = originals.audit;
  }
});

test("Industry deletion is permanently blocked by historical or current Account use", async () => {
  const originals = {
    matrix: RoleAccessMatrix.findOne,
    transaction: sequelize.transaction,
    findByPk: Industry.findByPk,
    historyCount: AccountIndustryHistory.count,
    accountCount: Account.count,
  };
  let destroyed = false;
  RoleAccessMatrix.findOne = async () => ({ can_delete: true });
  sequelize.transaction = async () => ({ commit: async () => {}, rollback: async () => {}, LOCK: { UPDATE: "UPDATE" } });
  Industry.findByPk = async () => ({ id: "ind-1", industry_code: "IND-01", name: "Energy", status: "INACTIVE", destroy: async () => { destroyed = true; } });
  AccountIndustryHistory.count = async () => 1;
  Account.count = async () => 0;
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/api/v1/internal/industries/ind-1`, { method: "DELETE", headers: headers("sales") });
      assert.equal(response.status, 409);
      assert.equal(destroyed, false);
    });
  } finally {
    RoleAccessMatrix.findOne = originals.matrix;
    sequelize.transaction = originals.transaction;
    Industry.findByPk = originals.findByPk;
    AccountIndustryHistory.count = originals.historyCount;
    Account.count = originals.accountCount;
  }
});
