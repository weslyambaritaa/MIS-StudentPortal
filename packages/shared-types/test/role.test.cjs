const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BUSINESS_ROLE_ORDER,
  BUSINESS_ROLES,
  EXTERNAL_ROLES,
  INTERNAL_ROLES,
  isBusinessRole,
  isExternalRole,
  isInternalRole,
  isRole,
  ROLES,
} = require("../dist/role.js");

test("business roles and fallback order are centralized and deterministic", () => {
  assert.deepEqual(BUSINESS_ROLES, [
    "student",
    "pic",
    "trainer",
    "sales",
    "admin",
    "finance",
    "management",
  ]);
  assert.deepEqual(BUSINESS_ROLE_ORDER, BUSINESS_ROLES);
  assert.equal(Object.hasOwn(ROLES, "SUPER_ADMIN"), false);
});

test("role guards accept only business roles and classify service boundaries", () => {
  assert.equal(isRole("sales"), true);
  assert.equal(isBusinessRole("management"), true);
  assert.equal(isRole("super_admin"), false);
  assert.equal(isRole(undefined), false);
  assert.equal(isExternalRole("trainer"), true);
  assert.equal(isExternalRole("sales"), false);
  assert.equal(isInternalRole("finance"), true);
  assert.equal(isInternalRole("student"), false);

  assert.deepEqual(EXTERNAL_ROLES, ["student", "pic", "trainer"]);
  assert.deepEqual(INTERNAL_ROLES, ["sales", "admin", "finance", "management"]);
});
