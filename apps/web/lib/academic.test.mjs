import test from "node:test";
import assert from "node:assert/strict";
import { academicProfileInput } from "../../../packages/shared/src/schemas/index.ts";

test("academic profile accepts an optional official track", () => {
  const input = {
    programmeId: "fin",
    trackId: "fin-global",
    studyYear: 1,
    classGroupId: "44",
  };

  assert.deepEqual(academicProfileInput.parse(input), input);
  assert.equal(
    academicProfileInput.safeParse({ ...input, trackId: "" }).success,
    false
  );
});
