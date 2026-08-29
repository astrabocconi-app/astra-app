import assert from "node:assert/strict";
import test from "node:test";

process.env.CARD_TOKEN_HMAC_SECRET = "test-only-card-token-secret";

const { signCardToken, verifyCardToken } = await import("./card-token.ts");

test("card tokens round-trip for their owner", () => {
  const token = signCardToken("student-1");

  assert.deepEqual(verifyCardToken(token), { userId: "student-1" });
});

test("card tokens reject tampering and malformed input", () => {
  const token = signCardToken("student-1");
  const [payload, signature] = token.split(".");

  assert.equal(verifyCardToken(`${payload}x.${signature}`), null);
  assert.equal(verifyCardToken("not-a-token"), null);
});
