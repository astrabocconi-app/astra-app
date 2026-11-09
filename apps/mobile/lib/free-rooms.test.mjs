import test from "node:test";
import assert from "node:assert/strict";
import { withBuffer } from "./free-rooms.ts";

const at = 10 * 60; // 10:00

test("free rooms end 15 minutes before the next class", () => {
  assert.deepEqual(withBuffer({ status: "free", freeUntil: "11:00" }, at), { status: "free", freeUntil: "10:45" });
  assert.deepEqual(withBuffer({ status: "free", freeUntil: "12:00", studyUntil: "12:00" }, at), {
    status: "free",
    freeUntil: "11:45",
    studyUntil: "11:45",
  });
  assert.deepEqual(withBuffer({ status: "free", freeUntil: "12:00", studyUntil: "11:00" }, at).studyUntil, "11:00");
});

test("a room whose next class is under 15 minutes away is not offered", () => {
  assert.equal(withBuffer({ status: "free", freeUntil: "10:15" }, at).status, "occupied");
  assert.equal(withBuffer({ status: "free", freeUntil: "10:10" }, at).status, "occupied");
  assert.equal(withBuffer({ status: "free", freeUntil: "10:16" }, at).status, "free");
});

test("rooms free for the rest of the day and busy rooms are untouched", () => {
  const rest = { status: "free" };
  assert.equal(withBuffer(rest, at), rest);
  const busy = { status: "occupied", freeUntil: "11:00" };
  assert.equal(withBuffer(busy, at), busy);
});
