const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACCESS_ACTIONS,
  RESOURCE_GROUPS,
  isAccessAction,
  isResourceGroup,
} = require("../dist/access.js");

test("access actions are a closed CRUD vocabulary", () => {
  assert.deepEqual(Object.values(ACCESS_ACTIONS), ["VIEW", "CREATE", "EDIT", "DELETE"]);
  for (const action of Object.values(ACCESS_ACTIONS)) assert.equal(isAccessAction(action), true);
  assert.equal(isAccessAction("EXPORT"), false);
  assert.equal(isAccessAction(undefined), false);
});

test("resource groups are canonical business data groups, not arbitrary strings", () => {
  assert.ok(RESOURCE_GROUPS.includes("ACCOUNT"));
  assert.ok(RESOURCE_GROUPS.includes("REMOTE_LAB"));
  assert.equal(isResourceGroup("ACCOUNT"), true);
  assert.equal(isResourceGroup("SALES_SIDEBAR"), false);
  assert.equal(isResourceGroup("ACCESS_MATRIX_ADMIN"), false);
});
