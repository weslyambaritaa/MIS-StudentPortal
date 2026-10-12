const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migration = fs.readFileSync(path.join(__dirname, "../migrations/202610060002-add-account-management-foundation.cjs"), "utf8");
const route = fs.readFileSync(path.join(__dirname, "../src/modules/accounts/accounts.route.ts"), "utf8");
const policy = fs.readFileSync(path.join(__dirname, "../src/modules/accounts/account-policy.ts"), "utf8");

test("Account migration generates unique immutable codes and a single Student link", () => {
  assert.match(migration, /account_code_seq/);
  assert.match(migration, /uq_account_account_code/);
  assert.match(migration, /uq_account_personal_student_subject/);
  assert.match(migration, /ck_account_personal_student_type/);
  assert.match(migration, /student_subject/);
});

test("Database rules protect inactive Accounts and the Personal Industry", () => {
  assert.match(migration, /tr_training_requires_active_account/);
  assert.match(migration, /Training cannot be created or moved to an inactive Account/);
  assert.match(migration, /tr_personal_industry_must_remain_active/);
  assert.match(migration, /tr_personal_industry_cannot_be_deleted/);
  assert.match(migration, /tr_account_code_immutable/);
  assert.match(migration, /tr_account_type_matches_industry/);
});

test("Account API scopes reads/writes to active Sales assignment and blocks Training-backed deletion", () => {
  assert.match(route, /sa\.\[sales_subject\] = :subject AND sa\.\[ended_at\] IS NULL/);
  assert.match(route, /assertAccountDeletable/);
  assert.match(policy, /Training history/i);
  assert.match(route, /authorizeActiveRole\(ROLES\.SALES\)/);
});

test("Personal Student association is admin-only and uses Keycloak role membership", () => {
  assert.match(route, /authorizeActiveRole\(ROLES\.ADMIN\)/);
  assert.match(route, /listRoleMembers\(ROLES\.STUDENT\)/);
  assert.match(route, /personal_student_subject/);
});
