const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/202610060001-add-industry-code-and-usage-history.cjs");

test("Industry migration adds immutable-code storage and durable Account usage history", async () => {
  const calls = [];
  const transaction = { commit: async () => calls.push(["commit"]), rollback: async () => calls.push(["rollback"]) };
  const qi = {
    sequelize: {
      transaction: async () => transaction,
      query: async (sql) => {
        calls.push(["query", sql]);
        if (sql.includes("COUNT_BIG")) return [[{ count: 4 }]];
        return [[]];
      },
    },
    addColumn: async (...args) => calls.push(["addColumn", ...args]),
    changeColumn: async (...args) => calls.push(["changeColumn", ...args]),
    addIndex: async (...args) => calls.push(["addIndex", ...args]),
    createTable: async (...args) => calls.push(["createTable", ...args]),
  };
  const Sequelize = { STRING: (size) => `STRING(${size})`, UUID: "UUID", DATE: "DATE", UUIDV4: "UUIDV4", literal: (sql) => sql };
  await migration.up(qi, Sequelize);
  assert.ok(calls.some(([kind, table, column]) => kind === "addColumn" && table === "industry" && column === "industry_code"));
  assert.ok(calls.some(([kind, table]) => kind === "createTable" && table === "account_industry_history"));
  assert.ok(calls.some(([kind, sql]) => kind === "query" && sql.includes("CREATE TRIGGER [dbo].[tr_account_industry_history]")));
  assert.ok(calls.some(([kind, sql]) => kind === "query" && sql.includes("START WITH 5")));
  assert.deepEqual(calls.at(-1), ["commit"]);
});

test("Industry migration refuses rollback after any use-history exists", async () => {
  const qi = { sequelize: { query: async () => [[{ id: "history-row" }]] } };
  await assert.rejects(migration.down(qi), /Refusing to remove Industry usage history/);
});
