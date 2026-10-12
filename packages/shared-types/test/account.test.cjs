const assert = require("node:assert/strict");
const test = require("node:test");
const { ACCOUNT_SOURCES, KEYCLOAK_ADMIN_ROLES, isAccountSource, isBusinessRole, isKeycloakAdminRole } = require("../dist/index.js");

test("account provenance and infrastructure administrator role are separate from business roles", () => {
  assert.deepEqual(Object.values(ACCOUNT_SOURCES), ["MANUAL", "AUTOMATIC"]);
  assert.equal(KEYCLOAK_ADMIN_ROLES.USER_PROVISIONER, "mis-user-provisioner");
  assert.equal(isAccountSource("MANUAL"), true);
  assert.equal(isAccountSource("AUTOMATIC"), true);
  assert.equal(isAccountSource("sales"), false);
  assert.equal(isKeycloakAdminRole("mis-user-provisioner"), true);
  assert.equal(isBusinessRole("mis-user-provisioner"), false);
});
