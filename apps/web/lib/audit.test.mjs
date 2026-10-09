import test from "node:test";
import assert from "node:assert/strict";
import { scrubWith, changedFields, auditVerb } from "./audit-diff.ts";

// A stand-in for the HMAC in email-hash.ts (tested on its own): deterministic, case-insensitive.
const fakeHash = (e) => Buffer.from(e.trim().toLowerCase()).toString("hex").padEnd(10, "0");
const scrubMetadata = (v) => scrubWith(v, fakeHash);

test("emails are replaced by a short hash, keeping the domain", () => {
  const out = scrubMetadata({ name: "mario.rossi@studbocconi.it", nested: [{ note: "ping a@unibocconi.it now" }], n: 3 });
  assert.match(out.name, /^[0-9a-f]{10}@studbocconi.it$/);
  assert.match(out.nested[0].note, /^ping [0-9a-f]{10}@unibocconi.it now$/);
  assert.equal(out.n, 3);
  assert.ok(!JSON.stringify(out).includes("rossi"));
});

test("the same address always hashes the same, so rows can still be correlated", () => {
  assert.equal(scrubMetadata("A@studbocconi.it"), scrubMetadata("a@studbocconi.it"));
});

test("changedFields only reports real changes", () => {
  const before = { title: "A", published: false, links: [] };
  const after = { title: "A", published: true, links: [] };
  assert.deepEqual(changedFields(before, after, ["title", "published", "links"]), { published: [false, true] });
  assert.deepEqual(changedFields(before, before, ["title", "published"]), {});
});

test("null and undefined count as the same empty value", () => {
  assert.deepEqual(changedFields({ location: null }, { location: undefined }, ["location"]), {});
});

test("long text is clipped in the diff", () => {
  const long = "x".repeat(500);
  const d = changedFields({ body: "a" }, { body: long }, ["body"]);
  assert.equal(d.body[1].length, 81);
});

test("auditVerb says publish/unpublish only for a pure visibility flip", () => {
  assert.equal(auditVerb({ published: [false, true] }, "published"), "publish");
  assert.equal(auditVerb({ published: [true, false] }, "published"), "unpublish");
  assert.equal(auditVerb({ published: [false, true], title: ["a", "b"] }, "published"), "update");
  assert.equal(auditVerb({ title: ["a", "b"] }, "published"), "update");
});
