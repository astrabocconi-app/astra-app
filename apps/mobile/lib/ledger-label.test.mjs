import assert from "node:assert/strict";
import test from "node:test";
import { ledgerLabel } from "./ledger-label.ts";

test("known server sentences map to keys with their parts", () => {
  assert.deepEqual(ledgerLabel("SIGNUP", "Welcome bonus for joining ASTRA"), { key: "points.signup", vars: {} });
  assert.deepEqual(ledgerLabel("PARTNER_SCAN", "Scanned at Casa · 20% off"), {
    key: "points.scannedOffer",
    vars: { place: "Casa", offer: "20% off" },
  });
  assert.deepEqual(ledgerLabel("PARTNER_SCAN", "Scanned at Casa"), { key: "points.scanned", vars: { place: "Casa" } });
  assert.deepEqual(ledgerLabel("REWARD_REDEMPTION", "Redeemed: Coffee"), { key: "points.redeemed", vars: { title: "Coffee" } });
  assert.deepEqual(ledgerLabel("ADMIN_ADJUSTMENT", "Refund: Coffee"), { key: "points.refund", vars: { title: "Coffee" } });
});

test("anything else is left to show as written", () => {
  assert.equal(ledgerLabel("ADMIN_ADJUSTMENT", "Manual correction"), null);
  assert.equal(ledgerLabel("OTHER", "Redeemed: x"), null);
});
