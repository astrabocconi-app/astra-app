import test from "node:test";
import assert from "node:assert/strict";

import { offerBadge } from "./offer-badge.ts";

const o = (title, discountType, discountValue, label) => ({ title, discountType, discountValue, label });

test("the badge is dropped when the title already says it", () => {
  assert.equal(offerBadge(o("10% off Pass for All packages", "PERCENT", 10, "10% off")), null);
  assert.equal(offerBadge(o("10 %", "PERCENT", 10, "10% off")), null);
  assert.equal(offerBadge(o("Lunch deal", "PERCENT", 20, "20% off")), "20% off");
  assert.equal(offerBadge(o("€40 off 8 Reformer Pilates classes", "FIXED", 4000, "€40 off")), null);
  assert.equal(offerBadge(o("New memberships", "FIXED", 7900, "€79 off")), "€79 off");
  assert.equal(offerBadge(o("Refer a friend: one free class", "FREEBIE", null, "Free")), null);
  assert.equal(offerBadge(o("Aperi Bocconi – €10", "OTHER", null, "Aperi Bocconi – €10")), null);
});

test("partial numbers don't count as a match", () => {
  assert.equal(offerBadge(o("15% off everything", "PERCENT", 5, "5% off")), "5% off");
  assert.equal(offerBadge(o("Spend €50, save", "FIXED", 500, "€5 off")), "€5 off");
  assert.equal(offerBadge(o("€5 off, min €50", "FIXED", 500, "€5 off")), null);
  assert.equal(offerBadge(o("€5.50 off", "FIXED", 550, "€5.50 off")), null);
});
