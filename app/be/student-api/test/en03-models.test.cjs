const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../dist/database/models");

test("Student API models remote_lab as a Student PostgreSQL table with a logical training reference", () => {
  const remoteLab = models.RemoteLab;
  assert.equal(remoteLab.getTableName(), "remote_lab");
  assert.equal(remoteLab.rawAttributes.training_id.type.key, "UUID");
  assert.equal(remoteLab.rawAttributes.training_id.allowNull, false);
  assert.equal(remoteLab.rawAttributes.training_id.references, undefined);
  assert.ok(remoteLab.options.indexes.some((index) => index.name === "uq_remote_lab_training_id" && index.unique));
  assert.equal(remoteLab.associations.training, undefined);
});
