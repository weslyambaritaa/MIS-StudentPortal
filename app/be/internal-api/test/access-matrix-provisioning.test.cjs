const assert = require("node:assert/strict");
const test = require("node:test");

const { BUSINESS_ROLES, RESOURCE_GROUPS } = require("@mis/shared-types");
const migration = require("../migrations/202610010001-create-role-access-matrix.cjs");
const seeder = require("../seeders/202610010001-seed-st03-minimum-access-matrix.cjs");

function sqlServerSequelize() {
  return {
    UUID: "UUID",
    STRING: (size) => `STRING(${size})`,
    BOOLEAN: "BOOLEAN",
    DATE: "DATE",
    literal: (value) => ({ literal: value }),
  };
}

test("matrix migration schema is constrained to shared role/resource vocabularies", async () => {
  let createdTable;
  const sql = [];
  let uniqueIndex;
  const transaction = { commit: async () => {}, rollback: async () => {} };
  const qi = {
    sequelize: { transaction: async () => transaction, query: async (statement) => sql.push(statement) },
    createTable: async (name, columns) => { createdTable = { name, columns }; },
    addIndex: async (_table, fields, options) => { uniqueIndex = { fields, options }; },
  };

  await migration.up(qi, sqlServerSequelize());
  assert.equal(createdTable.name, "role_access_matrix");
  for (const action of ["can_view", "can_create", "can_edit", "can_delete"]) {
    assert.equal(createdTable.columns[action].allowNull, false);
    assert.equal(createdTable.columns[action].defaultValue, false);
  }
  assert.deepEqual(uniqueIndex.fields, ["role", "resource_group"]);
  assert.equal(uniqueIndex.options.unique, true);

  const roleCheck = sql.find((statement) => statement.includes("ck_role_access_matrix_business_role"));
  const resourceCheck = sql.find((statement) => statement.includes("ck_role_access_matrix_resource_group"));
  const valuesIn = (statement) => [...statement.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(valuesIn(roleCheck), BUSINESS_ROLES);
  // PIC is introduced additively in the ST-12 migration; this base migration stays immutable.
  assert.deepEqual(valuesIn(resourceCheck), RESOURCE_GROUPS.filter((resource) => resource !== "PIC"));
});

test("matrix seed provisions only the explicit least-privilege Sales Account VIEW grant and audits it", async () => {
  const state = { matrix: [], audits: [], commits: 0 };
  const qi = {
    sequelize: {
      transaction: async () => ({
        commit: async () => { state.commits += 1; },
        rollback: async () => { throw new Error("unexpected rollback"); },
      }),
      query: async (_statement, { replacements }) => [state.matrix.filter((row) =>
        row.role === replacements.role && row.resource_group === replacements.resource_group)],
    },
    bulkInsert: async (table, rows) => state[table === "role_access_matrix" ? "matrix" : "audits"].push(...rows),
    bulkDelete: async (table, where) => {
      const target = table === "role_access_matrix" ? state.matrix : state.audits;
      const index = target.findIndex((row) => row.id === where.id);
      if (index >= 0) target.splice(index, 1);
    },
  };

  await seeder.up(qi);
  await seeder.up(qi);
  assert.equal(state.matrix.length, 1);
  assert.deepEqual(
    (({ role, resource_group, can_view, can_create, can_edit, can_delete }) =>
      ({ role, resource_group, can_view, can_create, can_edit, can_delete }))(state.matrix[0]),
    {
      role: "sales",
      resource_group: "ACCOUNT",
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: false,
    },
  );
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].actor_subject, "SYSTEM:ST03_SEED");
  assert.equal(state.audits[0].action, "CREATE");
  assert.equal(state.audits[0].object_type, "ROLE_ACCESS_MATRIX");
  assert.equal(JSON.parse(state.audits[0].data_after).can_delete, false);
});

test("matrix seed rollback removes only its row and keeps an audit event", async () => {
  const state = {
    matrix: [{ id: "seed-row", role: "sales", resource_group: "ACCOUNT", can_view: true }],
    audits: [],
  };
  const qi = {
    sequelize: {
      transaction: async () => ({ commit: async () => {}, rollback: async () => {} }),
      query: async () => [state.matrix],
    },
    bulkDelete: async (_table, where) => {
      state.matrix = state.matrix.filter((row) => row.id !== where.id);
    },
    bulkInsert: async (_table, rows) => state.audits.push(...rows),
  };

  await seeder.down(qi);
  assert.equal(state.matrix.length, 0);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, "DELETE");
  assert.equal(JSON.parse(state.audits[0].data_before).resource_group, "ACCOUNT");
  assert.equal(state.audits[0].data_after, null);
});
