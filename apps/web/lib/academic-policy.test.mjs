import test from "node:test";
import assert from "node:assert/strict";
import { compareClassGroupCodes, trackRequired } from "./academic-policy.ts";

test("class groups sort numerically", () => {
  assert.deepEqual(["10", "8", "9"].sort(compareClassGroupCodes), ["8", "9", "10"]);
});

test("a track is required once an active track is open for the year", () => {
  const tracks = [{ active: true, fromYear: 2 }];
  assert.equal(trackRequired(tracks, 1), false);
  assert.equal(trackRequired(tracks, 2), true);
  assert.equal(trackRequired([{ active: false, fromYear: 1 }], 3), false);
  assert.equal(trackRequired([], 3), false);
});
