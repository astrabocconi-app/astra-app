import test from "node:test";
import assert from "node:assert/strict";
import { shouldNotify } from "./news-push-policy.ts";

const base = { requested: true, published: true, alreadyPushedAt: null, notifyAgain: false };

test("notifies the first time a published post asks for it", () => {
  assert.equal(shouldNotify(base), true);
});
test("never notifies a draft or when not asked", () => {
  assert.equal(shouldNotify({ ...base, published: false }), false);
  assert.equal(shouldNotify({ ...base, requested: false }), false);
});
test("re-saving an already-notified post does not notify again, unless explicit", () => {
  const sent = { ...base, alreadyPushedAt: new Date() };
  assert.equal(shouldNotify(sent), false);
  assert.equal(shouldNotify({ ...sent, notifyAgain: true }), true);
});
