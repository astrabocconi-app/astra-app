import test from "node:test";
import assert from "node:assert/strict";
import { flattenRosters, matchAccounts, nameTokens } from "./roster-match.ts";

const rosters = [
  {
    course: "BIEM",
    classes: [
      { year: "Primo anno", path: "Primo anno/14", students: ["MARIO GIUSEPPE ROSSI", "ÖZGUR AYVAZ", "LUCA BIANCHI"] },
      { year: "Primo anno", path: "Primo anno/16", students: ["LUCA BIANCHI", "ANNA VERDI"] },
    ],
  },
  { course: "BAI", classes: [{ year: "Secondo anno", path: "Secondo anno", students: ["KARIM R. A. ABUWARDA"] }] },
];

test("tokens ignore case, accents, initials and preview-user noise", () => {
  assert.deepEqual(nameTokens("ÖZGUR AYVAZ"), ["ozgur", "ayvaz"]);
  assert.deepEqual(nameTokens("FEDERICO VEGNI\\_PreviewUser"), ["federico", "vegni"]);
});

test("flatten reads year and class code", () => {
  const e = flattenRosters(rosters);
  assert.deepEqual([e[0].year, e[0].classCode], [1, "14"]);
  assert.deepEqual([e[5].year, e[5].classCode], [2, "—"]);
});

test("matches swapped order, accents, partial names and email-only accounts", () => {
  const e = flattenRosters(rosters);
  const r = matchAccounts(e, [
    { name: "rossi mario", email: "x@y.it" },
    { name: null, email: "ozgur.ayvaz3@studbocconi.it" },
    { name: "Karim Abuwarda", email: "k@y.it" },
    { name: "Anna Verdi", email: "a@y.it" },
    { name: "Nobody Here", email: "n@y.it" },
  ]);
  assert.deepEqual(r.installed, [true, true, false, false, true, true]);
  assert.equal(r.unmatchedAccounts, 1);
});

test("a name on two rosters is ambiguous, not double counted", () => {
  const e = flattenRosters(rosters);
  const r = matchAccounts(e, [{ name: "Luca Bianchi", email: "l@y.it" }]);
  assert.equal(r.ambiguousAccounts, 1);
  assert.ok(r.installed.every((x) => !x));
});

test("programme and year from the profile break a tie", () => {
  const e = flattenRosters(rosters);
  const r = matchAccounts(e, [{ name: "Luca Bianchi", email: "l@y.it", hint: { course: "biem", year: 1 } }]);
  assert.equal(r.ambiguousAccounts, 1); // both rosters are BIEM year 1: still a tie
  const t = matchAccounts(e, [{ name: "Mario Rossi", email: "m@y.it", hint: { course: "BIEM", year: 1 } }]);
  assert.equal(t.matchedAccounts, 1);
});
