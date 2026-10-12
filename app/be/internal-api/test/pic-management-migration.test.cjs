const assert = require("node:assert/strict");
const test = require("node:test");
const migration = require("../migrations/202610070001-add-pic-management.cjs");

test("PIC management migration adds lifecycle fields and grants its matrix resource only to Sales", async () => {
  const calls = [];
  const qi = {
    sequelize: { transaction: async (callback) => callback({}), query: async (sql) => calls.push(["query", sql]) },
    addColumn: async (...args) => calls.push(["addColumn", ...args]),
    changeColumn: async (...args) => calls.push(["changeColumn", ...args]),
    addIndex: async (...args) => calls.push(["addIndex", ...args]),
    removeIndex: async (...args) => calls.push(["removeIndex", ...args]),
    bulkInsert: async (...args) => calls.push(["bulkInsert", ...args]),
    bulkDelete: async (...args) => calls.push(["bulkDelete", ...args]),
    removeColumn: async (...args) => calls.push(["removeColumn", ...args]),
  };
  const Sequelize = { STRING: (size) => `STRING(${size})`, DATE: "DATE" };
  await migration.up(qi, Sequelize);
  assert.ok(calls.some(([kind, table, column]) => kind === "addColumn" && table === "pic_profile" && column === "status"));
  assert.ok(calls.some(([kind, table, fields, options]) => kind === "addIndex" && table === "pic_profile" && fields[0] === "email" && options.unique));
  assert.ok(calls.some(([kind, sql]) => kind === "query" && sql.includes("ck_role_access_matrix_resource_group")));
  const matrixRows = calls.find(([kind, table]) => kind === "bulkInsert" && table === "role_access_matrix")[2];
  assert.equal(matrixRows.length, 7);
  assert.deepEqual(matrixRows.filter((row) => row.can_view).map((row) => row.role), ["sales"]);
  assert.ok(matrixRows.filter((row) => row.role !== "sales").every((row) => !row.can_create && !row.can_edit && !row.can_delete));
});
