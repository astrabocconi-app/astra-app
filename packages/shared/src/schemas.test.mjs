import test from "node:test";
import assert from "node:assert/strict";
import {
  eventInput, eventPatchInput, newsPatchInput, rewardInput, partnerOfferInput, partnerInput,
  pushRegisterInput, isInAppRoute, rewardPatchInput,
} from "./schemas/index.ts";

const event = { title: "Party", startsAt: "2026-10-10T21:30:00+02:00" };

test("event times need a timezone offset and the end cannot precede the start", () => {
  assert.equal(eventInput.safeParse(event).success, true);
  assert.equal(eventInput.safeParse({ ...event, startsAt: "2026-10-10T21:30" }).success, false);
  assert.equal(eventInput.safeParse({ ...event, endsAt: "2026-10-10T20:00:00+02:00" }).success, false);
  assert.equal(eventInput.safeParse({ ...event, endsAt: "2026-10-11T01:00:00+02:00" }).success, true);
  assert.equal(eventPatchInput.safeParse({ startsAt: "2026-10-10T21:30:00+02:00", endsAt: "2026-10-10T20:00:00+02:00" }).success, false);
});

test("ticket links must be https and blanks become null", () => {
  assert.equal(eventInput.safeParse({ ...event, externalTicketUrl: "javascript:alert(1)" }).success, false);
  assert.equal(eventInput.safeParse({ ...event, externalTicketUrl: "http://x.test" }).success, false);
  const ok = eventInput.parse({ ...event, externalTicketUrl: "", description: "  ", location: "" });
  assert.equal(ok.externalTicketUrl, null);
  assert.equal(ok.description, null);
  assert.equal(ok.location, null);
});

test("patch schemas have no defaults: omitting a flag leaves it alone", () => {
  assert.deepEqual(newsPatchInput.parse({ title: "x" }), { title: "x" });
  assert.deepEqual(eventPatchInput.parse({ title: "x" }), { title: "x" });
  assert.deepEqual(rewardPatchInput.parse({ title: "x" }), { title: "x" });
});

test("reward stock: empty is an error, null is unlimited, perUserLimit blank is none", () => {
  const base = { title: "Tote", costPoints: 50 };
  assert.equal(rewardInput.safeParse({ ...base, stock: "" }).success, false);
  assert.equal(rewardInput.parse({ ...base, stock: null }).stock, null);
  assert.equal(rewardInput.parse({ ...base, stock: 5 }).stock, 5);
  assert.equal(rewardInput.parse({ ...base, stock: 5, perUserLimit: "" }).perUserLimit, null);
});

test("a percentage offer cannot exceed 100", () => {
  assert.equal(partnerOfferInput.safeParse({ title: "x", discountType: "PERCENT", discountValue: 150 }).success, false);
  assert.equal(partnerOfferInput.safeParse({ title: "x", discountType: "FIXED", discountValue: 150 }).success, true);
  assert.equal(partnerInput.parse({ name: "Bar", address: "" }).address, null);
});

test("image refs must be https or an uploaded asset", () => {
  assert.equal(newsPatchInput.safeParse({ imageUrl: "http://x.test/a.png" }).success, false);
  assert.equal(newsPatchInput.safeParse({ imageUrl: "https://x.test/a.png" }).success, true);
  assert.equal(newsPatchInput.safeParse({ imageUrl: "/api/media/abc123" }).success, true);
});

test("only real Expo tokens register", () => {
  assert.equal(pushRegisterInput.safeParse({ token: "ExponentPushToken[abc]", platform: "IOS" }).success, true);
  assert.equal(pushRegisterInput.safeParse({ token: "nope", platform: "IOS" }).success, false);
});

test("item routes are in-app routes", () => {
  assert.equal(isInAppRoute("/rewards"), true);
  assert.equal(isInAppRoute("/news/ckabc123"), true);
  assert.equal(isInAppRoute("/news/../x"), false);
  assert.equal(isInAppRoute("https://evil.test"), false);
});
