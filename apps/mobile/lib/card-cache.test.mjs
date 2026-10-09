import assert from "node:assert/strict";
import test from "node:test";
import { CARD_MAX_AGE_MS, parseCardCache, pickCardToken } from "./card-cache.ts";

const NOW = 1_000_000_000_000;
const cache = (over = {}) => ({ uid: "u1", token: "tok", savedAt: NOW - 60_000, ...over });

test("parseCardCache accepts only the current shape", () => {
  assert.deepEqual(parseCardCache(JSON.stringify(cache())), cache());
  assert.equal(parseCardCache("just-a-legacy-token"), null);
  assert.equal(parseCardCache(JSON.stringify({ uid: "u1", token: "t" })), null);
  assert.equal(parseCardCache(null), null);
});

test("a cached token of another account is never shown", () => {
  assert.equal(pickCardToken(null, cache({ uid: "someone-else" }), "u1", NOW), null);
  assert.equal(pickCardToken(null, cache(), null, NOW), null);
  assert.deepEqual(pickCardToken(null, cache(), "u1", NOW), { token: "tok", stale: false });
});

test("a token older than 10 minutes is stale, a live one is judged by its fetch time", () => {
  assert.equal(pickCardToken(null, cache({ savedAt: NOW - CARD_MAX_AGE_MS - 1 }), "u1", NOW)?.stale, true);
  assert.equal(pickCardToken({ token: "fresh", at: NOW - 1000 }, cache({ savedAt: 0 }), "u1", NOW)?.stale, false);
  assert.equal(pickCardToken({ token: "old", at: NOW - 11 * 60_000 }, null, "u1", NOW)?.stale, true);
});

test("a clock that jumped backwards counts as stale", () => {
  assert.equal(pickCardToken(null, cache({ savedAt: NOW + 3_600_000 }), "u1", NOW)?.stale, true);
});
