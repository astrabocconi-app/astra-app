import assert from "node:assert/strict";
import test from "node:test";
import { ROME_TZ, romeInputToIso, isoToRomeInput } from "./rome-time.ts";

test("summer time is +02:00, winter time is +01:00", () => {
  assert.equal(ROME_TZ, "Europe/Rome");
  assert.equal(romeInputToIso("2026-10-10T21:30"), "2026-10-10T21:30:00+02:00");
  assert.equal(romeInputToIso("2026-12-05T21:30"), "2026-12-05T21:30:00+01:00");
  assert.equal(new Date(romeInputToIso("2026-10-10T21:30")).toISOString(), "2026-10-10T19:30:00.000Z");
});

test("round trip is stable, whatever the machine timezone", () => {
  for (const v of ["2026-01-01T00:00", "2026-07-15T23:59", "2026-03-29T01:59", "2026-03-29T03:00", "2026-10-25T03:00"]) {
    assert.equal(isoToRomeInput(romeInputToIso(v)), v);
  }
  // 19:30Z in October is 21:30 in Milan.
  assert.equal(isoToRomeInput("2026-10-10T19:30:00.000Z"), "2026-10-10T21:30");
  assert.equal(isoToRomeInput("2026-12-05T20:30:00Z"), "2026-12-05T21:30");
});

test("spring forward (29 Mar 2026): the skipped hour moves ahead", () => {
  assert.equal(romeInputToIso("2026-03-29T01:30"), "2026-03-29T01:30:00+01:00");
  assert.equal(romeInputToIso("2026-03-29T02:30"), "2026-03-29T03:30:00+02:00");
  assert.equal(romeInputToIso("2026-03-29T03:30"), "2026-03-29T03:30:00+02:00");
});

test("fall back (25 Oct 2026): the repeated hour takes its first occurrence", () => {
  assert.equal(romeInputToIso("2026-10-25T01:30"), "2026-10-25T01:30:00+02:00");
  assert.equal(romeInputToIso("2026-10-25T02:30"), "2026-10-25T02:30:00+02:00");
  assert.equal(romeInputToIso("2026-10-25T03:30"), "2026-10-25T03:30:00+01:00");
  assert.equal(isoToRomeInput("2026-10-25T01:30:00Z"), "2026-10-25T02:30");
});

test("seconds are kept, junk is rejected", () => {
  assert.equal(romeInputToIso("2026-10-10T21:30:15"), "2026-10-10T21:30:15+02:00");
  assert.throws(() => romeInputToIso("tomorrow"), RangeError);
  assert.equal(isoToRomeInput("nope"), "");
});
