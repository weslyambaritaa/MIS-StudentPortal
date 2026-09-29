const assert = require("node:assert/strict");
const test = require("node:test");

process.env.DB_HOST ??= "localhost";
process.env.DB_NAME ??= "mis_test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";

const { sequelize } = require("../dist/database/sequelize.js");
const {
  findSessionsInTrainerScope,
  findTrainingsInTrainerScope,
} = require("../dist/modules/trainings/trainer-scope.js");

test("Trainer Session scope handles both training and session-level replacement", async () => {
  const originalQuery = sequelize.query;
  let sql;
  let options;
  sequelize.query = async (query, queryOptions) => {
    sql = query;
    options = queryOptions;
    return [];
  };

  try {
    await findSessionsInTrainerScope("trainer-profile-123");
  } finally {
    sequelize.query = originalQuery;
  }

  assert.match(sql, /replaced_training_assignment_id = tta\.id/);
  assert.match(sql, /replaced_session_assignment_id = sta\.id/);
  assert.match(sql, /assignment_type = 'ASSISTANT'/);
  assert.match(sql, /substitute_assignment_id = sta\.id/);
  assert.deepEqual(options.replacements, { trainerProfileId: "trainer-profile-123" });
});

test("Trainer Training scope includes training and effective session assignments", async () => {
  const originalQuery = sequelize.query;
  let sql;
  sequelize.query = async (query) => {
    sql = query;
    return [];
  };

  try {
    await findTrainingsInTrainerScope("trainer-profile-123");
  } finally {
    sequelize.query = originalQuery;
  }

  assert.match(sql, /training_trainer_assignment AS tta/);
  assert.match(sql, /session_trainer_assignment AS sta/);
  assert.match(sql, /replaced_session_assignment_id = sta\.id/);
});

test("Trainer scope rejects an empty profile identity", () => {
  assert.throws(() => findSessionsInTrainerScope(" "), /Trainer profile ID is required/);
});
