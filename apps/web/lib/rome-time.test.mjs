import test from "node:test";
import assert from "node:assert/strict";
import { romeDateKey, startOfRomeDay, addDaysToKey, bucketKeys, mondayOnOrBefore } from "./rome-time.ts";

test("the Rome day starts at local midnight, not UTC midnight", () => {
  // 23:30Z on 9 Oct is already 01:30 on 10 Oct in Rome (CEST, UTC+2).
  const at = new Date("2026-10-09T23:30:00Z");
  assert.equal(romeDateKey(at), "2026-10-10");
  assert.equal(startOfRomeDay(at).toISOString(), "2026-10-09T22:00:00.000Z");
});

test("winter time uses UTC+1", () => {
  const at = new Date("2026-12-15T23:30:00Z");
  assert.equal(romeDateKey(at), "2026-12-16");
  assert.equal(startOfRomeDay(at).toISOString(), "2026-12-15T23:00:00.000Z");
});

test("the day of a DST switch is 23 or 25 hours long, not 24", () => {
  // Clocks go forward on Sunday 28 March 2027.
  const start = startOfRomeDay(new Date("2027-03-28T12:00:00Z"));
  const next = startOfRomeDay(new Date("2027-03-29T12:00:00Z"));
  assert.equal((next.getTime() - start.getTime()) / 3600000, 23);
});

test("day arithmetic crosses month and year ends", () => {
  assert.equal(addDaysToKey("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysToKey("2026-03-01", -1), "2026-02-28");
});

test("buckets are gap-free and weeks start on Monday", () => {
  assert.deepEqual(bucketKeys("2026-10-08", "2026-10-10", "day"), ["2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.equal(mondayOnOrBefore("2026-10-10"), "2026-10-05"); // a Saturday
  assert.deepEqual(bucketKeys("2026-10-01", "2026-10-14", "week"), ["2026-09-28", "2026-10-05", "2026-10-12"]);
});
