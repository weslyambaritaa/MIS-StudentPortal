const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/202610050001-extend-audit-trail-and-create-archive.cjs");

test("Audit Trail migration extends the existing table and creates archive in the same database", async () => {
  const changes = [];
  const qi = {
    sequelize: { transaction: async (callback) => callback({ transaction: true }) },
    addColumn: async (table, column) => changes.push(["column", table, column]),
    addIndex: async (table, fields, options) => changes.push(["index", table, options.name]),
    createTable: async (table, columns) => changes.push(["table", table, Object.keys(columns)]),
  };
  await migration.up(qi, {
    STRING: (size) => `STRING(${size})`, UUID: "UUID", DATE: "DATE", TEXT: (size) => `TEXT(${size})`,
    literal: (sql) => sql,
  });
  assert.ok(changes.some(([kind, table]) => kind === "column" && table === "audit_trail"));
  assert.ok(changes.some(([kind, table]) => kind === "table" && table === "audit_trail_archive"));
  assert.ok(!changes.some(([kind, table]) => kind === "table" && table === "new_database"));
  await assert.rejects(migration.down(qi), /Refusing to remove Audit Trail schema/);
});
