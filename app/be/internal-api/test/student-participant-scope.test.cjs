const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DB_HOST ??= "localhost";
process.env.DB_NAME ??= "mis_test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";

const { Participant } = require("../dist/database/models/participant.model.js");
const { findParticipantsInStudentScope } = require("../dist/modules/participants/student-participant-scope.js");

test("Student Participant scope applies student_id filter in the database query", async () => {
  const originalFindAll = Participant.findAll;
  let queryOptions;
  Participant.findAll = async (options) => {
    queryOptions = options;
    return [];
  };

  try {
    await findParticipantsInStudentScope("student-id-123");
  } finally {
    Participant.findAll = originalFindAll;
  }

  assert.deepEqual(queryOptions.where, { student_id: "student-id-123" });
  assert.equal(queryOptions.include[0].as, "training");
  assert.equal(queryOptions.include[0].required, true);
  assert.deepEqual(queryOptions.include[0].attributes, ["id", "name"]);
});

test("Student Participant scope rejects an empty identity", () => {
  assert.throws(() => findParticipantsInStudentScope(" "), /Student ID is required/);
});
