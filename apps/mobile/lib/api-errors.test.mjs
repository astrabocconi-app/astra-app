import assert from "node:assert/strict";
import test from "node:test";
import { errorCode, errorKind } from "./api-errors.ts";

test("errors are told apart by status and code", () => {
  assert.equal(errorKind({ status: 0, code: "TIMEOUT" }), "timeout");
  assert.equal(errorKind({ status: 0, code: "NETWORK" }), "network");
  assert.equal(errorKind(new TypeError("boom")), "client");
  assert.equal(errorKind({ status: 429 }), "rateLimited");
  assert.equal(errorKind({ status: 401 }), "unauthorized");
  assert.equal(errorKind({ status: 503 }), "server");
  assert.equal(errorKind({ status: 400, code: "INVALID_CODE" }), "client");
  assert.equal(errorCode({ code: "BUSY" }), "BUSY");
  assert.equal(errorCode(null), undefined);
});
