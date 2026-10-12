const assert = require("node:assert/strict");
const test = require("node:test");

const migration = require("../migrations/202610020001-create-security-access-log.cjs");

test("security access-log schema carries the ST-08 attribution fields and stable event key", async () => {
  let table;
  const indexes = [];
  const qi = {
    sequelize: { transaction: async (callback) => callback({ id: "tx" }) },
    createTable: async (name, columns, options) => { table = { name, columns, options }; },
    addIndex: async (name, fields, options) => indexes.push({ name, fields, options }),
  };
  const Sequelize = {
    UUID: "UUID", STRING: (length) => `STRING(${length})`, DATE: "DATE", TEXT: (kind) => `TEXT(${kind})`,
    UUIDV4: "UUIDV4", literal: (value) => `LITERAL(${value})`,
  };

  await migration.up(qi, Sequelize);

  assert.equal(table.name, "security_access_log");
  for (const field of ["occurred_at", "actor_subject", "actor_type", "event_type", "object_type", "object_id", "ip_address", "source_system", "outcome"]) {
    assert.ok(field in table.columns, `missing ${field}`);
  }
  assert.equal(table.columns.event_key.allowNull, false);
  assert.ok(indexes.some((index) => index.options.unique && index.fields[0] === "event_key"));
  assert.ok(indexes.some((index) => index.fields[0] === "occurred_at"));
});

test("security audit migration refuses destructive rollback", async () => {
  await assert.rejects(migration.down({ dropTable: async () => assert.fail("must not drop audit evidence") }), /Refusing to drop security_access_log/);
});
