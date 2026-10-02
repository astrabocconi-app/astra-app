import assert from "node:assert/strict";
import test from "node:test";
import { guideLanguage } from "./guide-language.ts";

const S = "https://x.supabase.co/storage/v1/object/public/guides/";

test("explicit markers in the title or file name decide", () => {
  assert.equal(guideLanguage("Guida Associazioni IT", S + "Guida%20Associazioni%20ITA.pdf"), "it");
  assert.equal(guideLanguage("Associations Guide", S + "Guida%20Associazioni%20ENG.pdf"), "en");
  assert.equal(guideLanguage("LinkedIn English", S + "LinkedIn%20EN.pdf"), "en");
  assert.equal(guideLanguage("Free Mover Guide ENG", S + "Guida%20Free%20Mover%20ING.pdf"), "en");
  assert.equal(guideLanguage("Program Change ", S + "Guida%20cambio%20corso%20ENG.pdf"), "en");
});

test("without a marker, Italian title words mean Italian, otherwise English", () => {
  assert.equal(guideLanguage("Vivere a Milano", S + "Vivere-a-MI.pdf"), "it");
  assert.equal(guideLanguage("CLEACC Primo Anno", S + "Guida-CLEACC-primo-anno-nuova.pdf"), "it");
  assert.equal(guideLanguage("Living in Milan", S + "Living-in-Milan-U.pdf"), "en");
  assert.equal(guideLanguage("ICDL", S + "ICDL.pdf"), "en");
});
