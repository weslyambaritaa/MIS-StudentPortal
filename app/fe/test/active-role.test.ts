import assert from "node:assert/strict";
import test from "node:test";

import {
  getAvailableBusinessRoles,
  getSelectableActiveRole,
  resolveActiveRole,
} from "../src/lib/auth/active-role";

test("single role is automatically selected", () => {
  const available = getAvailableBusinessRoles(["sales"]);
  assert.deepEqual(available, ["sales"]);
  assert.equal(resolveActiveRole(available, "management"), "sales");
});

test("multi-role selection honors a valid stored preference", () => {
  const available = getAvailableBusinessRoles(["management", "sales"]);
  assert.deepEqual(available, ["sales", "management"]);
  assert.equal(resolveActiveRole(available, "management"), "management");
});

test("revoked or missing preference falls back by business order, not token order", () => {
  const available = getAvailableBusinessRoles(["management", "sales", "finance"]);
  assert.equal(resolveActiveRole(available, "trainer"), "sales");
  assert.equal(resolveActiveRole(available, null), "sales");
});

test("an authenticated account with no business role has no active role", () => {
  const available = getAvailableBusinessRoles(["offline_access", "uma_authorization"]);
  assert.deepEqual(available, []);
  assert.equal(resolveActiveRole(available, "sales"), null);
});

test("role switching only accepts a role currently assigned to the user", () => {
  const available = getAvailableBusinessRoles(["sales", "management"]);
  assert.equal(getSelectableActiveRole(available, "management"), "management");
  assert.equal(getSelectableActiveRole(available, "finance"), null);
});
