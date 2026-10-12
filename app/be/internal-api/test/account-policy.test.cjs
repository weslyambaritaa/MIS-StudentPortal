const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../dist/modules/accounts/account-policy.js");

test("Personal type follows the reserved Personal Industry code", () => {
  assert.equal(policy.accountTypeForIndustry("IND-PERSONAL"), "PERSONAL");
  assert.equal(policy.accountTypeForIndustry("IND-01"), "CORPORATE");
});

test("Account deletion is allowed only when no Training exists", () => {
  assert.doesNotThrow(() => policy.assertAccountDeletable(0));
  assert.throws(() => policy.assertAccountDeletable(1), (error) => error.statusCode === 409);
  assert.throws(() => policy.assertAccountDeletable(-1), TypeError);
});

test("Account type cannot change after Student, Participant, or Training history", () => {
  assert.doesNotThrow(() => policy.assertAccountTypeChangeAllowed({ linkedPersonalStudent: false, trainingCount: 0, participantCount: 0 }));
  assert.throws(() => policy.assertAccountTypeChangeAllowed({ linkedPersonalStudent: true, trainingCount: 0, participantCount: 0 }), (error) => error.statusCode === 409);
  assert.throws(() => policy.assertAccountTypeChangeAllowed({ linkedPersonalStudent: false, trainingCount: 1, participantCount: 0 }), (error) => error.statusCode === 409);
  assert.throws(() => policy.assertAccountTypeChangeAllowed({ linkedPersonalStudent: false, trainingCount: 0, participantCount: 1 }), (error) => error.statusCode === 409);
});
