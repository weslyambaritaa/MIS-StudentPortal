const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/202610050001-create-audit-outbox.cjs");

test("Student audit outbox migration is additive and keeps event payload for retry", async () => {
  let table;
  let index;
  const qi = {
    createTable: async (name, columns) => { table = { name, columns }; },
    addIndex: async (_name, _fields, options) => { index = options.name; },
  };
  await migration.up(qi, { UUID: "UUID", JSONB: "JSONB", INTEGER: "INTEGER", DATE: "DATE", literal: (sql) => sql });
  assert.equal(table.name, "audit_outbox");
  assert.equal(table.columns.event_id.primaryKey, true);
  assert.equal(table.columns.payload.allowNull, false);
  assert.equal(index, "ix_audit_outbox_delivery");
  await assert.rejects(migration.down(qi), /Refusing to drop pending audit outbox events/);
});
