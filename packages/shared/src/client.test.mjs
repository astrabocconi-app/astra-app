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
