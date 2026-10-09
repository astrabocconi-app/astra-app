import test from "node:test";
import assert from "node:assert/strict";
import { emailHash, normaliseEmail } from "./email-hash.ts";

test("the hash ignores case and surrounding whitespace", () => {
  assert.equal(emailHash(" Mario.Rossi@studbocconi.it "), emailHash("mario.rossi@studbocconi.it"));
  assert.equal(normaliseEmail(" A@B.it "), "a@b.it");
});

test("different addresses hash differently and never expose the address", () => {
  const a = emailHash("a@studbocconi.it");
  assert.notEqual(a, emailHash("b@studbocconi.it"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes("studbocconi"));
});

test("the secret changes the hash", () => {
  const before = emailHash("a@studbocconi.it");
  process.env.SIGNUP_TOMBSTONE_SECRET = "another-secret";
  try {
    assert.notEqual(emailHash("a@studbocconi.it"), before);
  } finally {
    delete process.env.SIGNUP_TOMBSTONE_SECRET;
  }
});
