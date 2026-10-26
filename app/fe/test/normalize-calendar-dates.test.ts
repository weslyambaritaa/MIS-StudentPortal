import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCalendarDates } from "../src/lib/normalize-calendar-dates";

test("normalizes, sorts, and deduplicates dates before grouping ranges", () => {
  assert.deepEqual(normalizeCalendarDates([
    "2026-11-02", " 2026-10-27 ", "2026-10-27T09:00:00Z", "2026-10-30",
  ]), ["2026-10-27", "2026-10-30", "2026-11-02"]);
});

test("rejects malformed dates that caused Invalid time value and impossible dates", () => {
  assert.deepEqual(normalizeCalendarDates([
    "Tue Oct 27", "undefined", null, "", "2026-13-01", "2026-02-30", "2026-02-29",
  ]), []);
  assert.deepEqual(normalizeCalendarDates(["2028-02-29"]), ["2028-02-29"]);
});
