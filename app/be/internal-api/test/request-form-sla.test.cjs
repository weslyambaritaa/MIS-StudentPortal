const test = require("node:test");
const assert = require("node:assert/strict");
const { addRequestFormBusinessHours } = require("../dist/modules/request-forms/request-form-sla");

test("24 business hours count Mon-Fri from 08:00 to 17:00 Jakarta time", () => {
  const dueAt = addRequestFormBusinessHours(new Date("2026-10-19T01:00:00.000Z"), 24, new Set());
  assert.equal(dueAt.toISOString(), "2026-10-21T07:00:00.000Z");
});

test("business-hour SLA skips weekends and configured national holidays", () => {
  const fromFriday = addRequestFormBusinessHours(new Date("2026-10-16T09:00:00.000Z"), 24, new Set());
  assert.equal(fromFriday.toISOString(), "2026-10-21T06:00:00.000Z");

  const withHoliday = addRequestFormBusinessHours(new Date("2026-10-19T01:00:00.000Z"), 24, new Set(["2026-10-20"]));
  assert.equal(withHoliday.toISOString(), "2026-10-22T07:00:00.000Z");
});
