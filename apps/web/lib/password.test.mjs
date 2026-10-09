import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

test("hash then verify round-trips and rejects a wrong password", async () => {
  const h = await hashPassword("correct horse battery");
  assert.match(h, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
});

test("verify copes with malformed stored values", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "nocolon"), false);
});

test("is compatible with the sync scheme used by scripts/create-admin.mjs", async () => {
  const { scryptSync, randomBytes } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const legacy = `${salt}:${scryptSync("pw-123456", salt, 64).toString("hex")}`;
  assert.equal(await verifyPassword("pw-123456", legacy), true);
});
