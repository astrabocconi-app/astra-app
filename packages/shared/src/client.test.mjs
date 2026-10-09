import assert from "node:assert/strict";
import test from "node:test";
import { createApiClient } from "./client/index.ts";

const reply = (status) => async () =>
  new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not signed in." } }), { status });

test("a rejected token signs the app out; a 401 without one doesn't", async () => {
  let calls = 0;
  globalThis.fetch = reply(401);
  const signedIn = createApiClient({ baseUrl: "https://x.test", getToken: () => "dead", onUnauthorized: () => calls++ });
  await assert.rejects(signedIn.me());
  assert.equal(calls, 1);

  // Signing in: no token sent, so a 401 is a wrong code, not a dead session.
  const signingIn = createApiClient({ baseUrl: "https://x.test", getToken: () => null, onUnauthorized: () => calls++ });
  await assert.rejects(signingIn.me());
  assert.equal(calls, 1);

  // A server error is not a sign-out.
  globalThis.fetch = reply(500);
  await assert.rejects(signedIn.me());
  assert.equal(calls, 1);
});

test("onUnauthorized receives the token that was rejected", async () => {
  let seen = null;
  globalThis.fetch = reply(401);
  const c = createApiClient({ baseUrl: "https://x.test", getToken: () => "old", onUnauthorized: (t) => (seen = t) });
  await assert.rejects(c.me());
  assert.equal(seen, "old");
});

test("non-JSON error bodies keep their status; network failures become status 0", async () => {
  const c = createApiClient({ baseUrl: "https://x.test" });
  globalThis.fetch = async () => new Response("<html>bad gateway</html>", { status: 502 });
  await assert.rejects(c.me(), (e) => e.status === 502);
  globalThis.fetch = async () => {
    throw new TypeError("Network request failed");
  };
  await assert.rejects(c.me(), (e) => e.status === 0 && e.code === "NETWORK");
});

test("a read that never answers times out with code TIMEOUT", async () => {
  const c = createApiClient({ baseUrl: "https://x.test" });
  globalThis.fetch = (_url, init) =>
    new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realSet(fn, 5);
  try {
    await assert.rejects(c.me(), (e) => e.code === "TIMEOUT");
  } finally {
    globalThis.setTimeout = realSet;
  }
});
