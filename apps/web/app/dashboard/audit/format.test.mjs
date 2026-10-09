import assert from "node:assert/strict";
import test from "node:test";
import { describeAction, describeTarget, fieldChanges, summarise } from "./format.ts";

test("plain and dotted actions read as sentences", () => {
  assert.deepEqual(describeAction("update"), { label: "updated", destructive: false });
  assert.deepEqual(describeAction("delete"), { label: "deleted", destructive: true });
  assert.equal(describeAction("staff.revoke").label, "revoked staff");
  assert.equal(describeAction("user.delete").label, "deleted user");
  assert.equal(describeAction("codes.delete").destructive, true);
  assert.equal(describeAction("something_odd").label, "something odd");
});

test("targets get friendly names", () => {
  assert.equal(describeTarget("NewsPost"), "News post");
  assert.equal(describeTarget("PartnerAccount"), "Venue login");
  assert.equal(describeTarget("SomeNewThing"), "Some New Thing");
});

test("field diffs are read from the top level or from changes", () => {
  const top = { title: "Party", discountPercent: [10, 20], published: [false, true] };
  assert.deepEqual(fieldChanges(top), [
    { field: "discount percent", from: "10", to: "20" },
    { field: "published", from: "no", to: "yes" },
  ]);
  assert.equal(fieldChanges({ changes: { location: ["A", null] } })[0].to, "empty");
  assert.deepEqual(fieldChanges(null), []);
  assert.deepEqual(fieldChanges([1, 2]), []);
});

test("timestamps in diffs are shown in Milan time", () => {
  const [c] = fieldChanges({ startsAt: ["2026-10-10T19:30:00.000Z", "2026-10-10T20:30:00.000Z"] });
  assert.match(c.from, /21:30/);
  assert.match(c.to, /22:30/);
});

test("summary prefers the title, then name", () => {
  assert.equal(summarise({ title: "X", name: "Y" }), "X");
  assert.equal(summarise({ name: "Y" }), "Y");
  assert.equal(summarise({ nothing: 1 }), null);
  assert.equal(summarise(null), null);
});
