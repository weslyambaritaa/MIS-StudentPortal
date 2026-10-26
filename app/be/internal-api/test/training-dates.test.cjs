const assert = require("node:assert/strict");
const test = require("node:test");
const { trainingDates } = require("../dist/modules/request-forms/training-dates");

test("training dates serialize Sequelize Dates as sorted unique WIB calendar dates", () => {
  assert.equal(trainingDates([
    new Date("2026-11-02T09:00:00+07:00"),
    new Date("2026-10-27T09:00:00+07:00"),
    "2026-10-26T18:00:00.000Z",
  ]), "2026-10-27,2026-11-02");
});

test("empty or invalid session dates do not crash serialization", () => {
  assert.equal(trainingDates([]), "");
  assert.equal(trainingDates([new Date(NaN), "invalid"]), "");
});
