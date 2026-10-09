import assert from "node:assert/strict";
import test from "node:test";
import { pickPlan } from "./calc-plan-map.ts";
import { GRADE_PLANS } from "../../../packages/shared/src/grade-plans.ts";

const keys = (type) => Object.keys(GRADE_PLANS[type]);
const pick = (type, code, track) => pickPlan(keys(type), code, track);

test("old and renamed catalogue codes reach their plan", () => {
  assert.equal(pick("master", "AFC"), "AFM");
  assert.equal(pick("master", "CLAPI"), "GIO");
  assert.equal(pick("master", "DES-ESS"), "ESS");
  assert.equal(pick("bachelor", "BESS-CLES"), "BESS");
  assert.equal(pick("bachelor", "BEMACC"), "CLEACC-ENG");
  assert.equal(pick("master", "INTENT"), "INTENT");
  assert.equal(pick("master", "EMIT"), "EMIT");
  assert.equal(pick("master", "FIN"), "FINANCE");
  assert.equal(pick("master", "CLEFIN-FINANCE"), "FINANCE");
  assert.equal(pick("master", "DAIHS"), "DAAIHS");
  assert.equal(pick("master", "CYBER"), "CRSG");
  assert.equal(pick("clmg", "CLMG"), "CLMG");
});

test("Management is not Marketing Management, and programmes without a plan get none", () => {
  assert.equal(pick("master", "M"), null);
  assert.equal(pick("bachelor", "WBB"), null);
  assert.equal(pick("bachelor", "BIEMF"), null);
  assert.equal(pick("master", "NOPE"), null);
  assert.equal(pick("master", undefined), null);
});

test("tracks pick the right plan", () => {
  assert.equal(pick("master", "IM", "GLOBAL"), "IM-GLOBAL");
  assert.equal(pick("master", "IM", "CONCENTRATIONS"), "IM-CONCENTRATION");
  assert.equal(pick("master", "IM", "CEMS"), "IM-GLOBAL");
  assert.equal(pick("master", "IM", "CHINA-MIM"), null); // no plan of its own: the screen asks
  assert.equal(pick("master", "IM"), null); // never the unverifiable old IM plan
  assert.equal(pick("master", "FIN", "FINANCE"), "FINANCE");
  assert.equal(pick("master", "FIN", "GLOBAL"), "FINANCE-GLOBAL");
  assert.equal(pick("master", "PPA", "LSE"), "PPA");
  assert.equal(pick("master", "DSBA", "BA"), "DSBA-BA");
  assert.equal(pick("master", "DSBA", "DS"), "DSBA-DS");
  assert.equal(pick("master", "DSBA"), null); // two tracks, can't tell
  assert.equal(pick("bachelor", "BIEF", "BIEF-FIN"), "BIEF-FIN");
  assert.equal(pick("bachelor", "BIEF", "BIEF-ECON"), "BIEF-ECON");
  assert.equal(pick("bachelor", "BIEF"), null);
  assert.equal(pick("bachelor", "BIG", "PPM"), "BIG");
  assert.equal(pick("bachelor", "BIG", "DSO"), "BIG-DSO");
  assert.equal(pick("bachelor", "BGL", "GL"), "BGL-GL");
  assert.equal(pick("bachelor", "BGL", "DL"), "BGL-DL");
  assert.equal(pick("bachelor", "BGL"), null);
  assert.equal(pick("bachelor", "CLEACC", "ITA"), "CLEACC");
  assert.equal(pick("bachelor", "CLEACC", "ENG"), "CLEACC-ENG");
  assert.equal(pick("bachelor", "CLEACC"), "CLEACC");
});

test("every plan key a mapping can return exists", () => {
  for (const type of ["bachelor", "master", "clmg"]) {
    for (const code of ["CLEAM", "CLEF", "BESS", "BEMACS", "BIEM", "BAI", "ACME", "AFM", "AI", "ESS", "GIO", "MM", "TS", "CLELI"]) {
      const p = pick(type, code);
      if (p) assert.ok(keys(type).includes(p));
    }
  }
});
