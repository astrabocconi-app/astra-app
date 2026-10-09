import assert from "node:assert/strict";
import test from "node:test";
import { academicYearId, profileNeedsYearCheck } from "./academic-year.ts";

test("the academic year turns over on 1 September", () => {
  assert.equal(academicYearId(new Date("2026-08-31T12:00:00Z")), "2025");
  assert.equal(academicYearId(new Date("2026-09-01T12:00:00Z")), "2026");
  assert.equal(academicYearId(new Date("2027-03-01T12:00:00Z")), "2026");
});

test("a profile saved before the year started needs a check", () => {
  const now = new Date("2026-10-09T10:00:00Z");
  assert.equal(profileNeedsYearCheck("2026-06-01T10:00:00Z", now), true);
  assert.equal(profileNeedsYearCheck("2026-09-15T10:00:00Z", now), false);
  assert.equal(profileNeedsYearCheck("not a date", now), false);
});
