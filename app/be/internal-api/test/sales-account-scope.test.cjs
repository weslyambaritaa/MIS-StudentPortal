const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DB_HOST ??= "localhost";
process.env.DB_NAME ??= "mis_test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";

const { Account } = require("../dist/database/models/account.model.js");
const { findAccountsInSalesScope } = require("../dist/modules/accounts/sales-account-scope.js");

test("Sales account scope filters active assignments in the database query", async () => {
  const originalFindAll = Account.findAll;
  let queryOptions;
  Account.findAll = async (options) => {
    queryOptions = options;
    return [];
  };

  try {
    await findAccountsInSalesScope("sales-sub-123");
  } finally {
    Account.findAll = originalFindAll;
  }

  assert.equal(queryOptions.include[0].required, true);
  assert.equal(queryOptions.include[0].as, "salesAssignments");
  assert.deepEqual(queryOptions.include[0].where, {
    sales_subject: "sales-sub-123",
    ended_at: null,
  });
  assert.deepEqual(queryOptions.include[0].attributes, []);
});

test("Sales account scope rejects an empty identity", () => {
  assert.throws(() => findAccountsInSalesScope("  "), /Keycloak subject is required/);
});
