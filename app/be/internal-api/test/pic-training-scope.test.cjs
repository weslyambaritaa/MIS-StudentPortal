const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DB_HOST ??= "localhost";
process.env.DB_NAME ??= "mis_test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";

const { Training } = require("../dist/database/models/training.model.js");
const { findTrainingsInPicScope } = require("../dist/modules/trainings/pic-training-scope.js");

test("PIC training scope joins through the active Account assignment", async () => {
  const originalFindAll = Training.findAll;
  let queryOptions;
  Training.findAll = async (options) => {
    queryOptions = options;
    return [];
  };

  try {
    await findTrainingsInPicScope("pic-profile-123");
  } finally {
    Training.findAll = originalFindAll;
  }

  assert.deepEqual(queryOptions.attributes, ["id", "account_id", "name"]);
  const assignmentJoin = queryOptions.include[0].include[0];
  assert.equal(queryOptions.include[0].required, true);
  assert.equal(assignmentJoin.as, "picAssignments");
  assert.equal(assignmentJoin.required, true);
  assert.deepEqual(assignmentJoin.where, {
    pic_profile_id: "pic-profile-123",
    ended_at: null,
  });
  assert.deepEqual(assignmentJoin.attributes, []);
});

test("PIC training scope rejects an empty profile identity", () => {
  assert.throws(() => findTrainingsInPicScope(" "), /PIC profile ID is required/);
});
