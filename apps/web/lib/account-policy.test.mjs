import test from "node:test";
import assert from "node:assert/strict";
import { deletionBlocker } from "./account-policy.ts";

test("a plain student may delete their account", () => {
  assert.equal(deletionBlocker({ roles: ["STUDENT"], hasPartnerMembership: false }), null);
});

test("an area manager who is also a student may still delete theirs", () => {
  assert.equal(deletionBlocker({ roles: ["STUDENT", "AREA_MANAGER"], hasPartnerMembership: false }), null);
});

test("partner logins are managed by ASTRA", () => {
  assert.match(deletionBlocker({ roles: ["PARTNER_MANAGER"], hasPartnerMembership: true }), /Partner accounts/);
  assert.match(deletionBlocker({ roles: ["STUDENT"], hasPartnerMembership: true }), /Partner accounts/);
});

test("staff and admin accounts cannot be deleted through the student flow", () => {
  assert.match(deletionBlocker({ roles: ["STAFF"], hasPartnerMembership: false }), /Team page/);
  assert.match(deletionBlocker({ roles: ["ADMIN"], hasPartnerMembership: false }), /Team page/);
});
