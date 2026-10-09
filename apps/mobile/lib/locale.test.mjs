import assert from "node:assert/strict";
import test from "node:test";
import { pickLanguage } from "./locale.ts";

test("stored choice wins, device language decides the first run", () => {
  assert.equal(pickLanguage("en", "it-IT"), "en");
  assert.equal(pickLanguage("it", "en-GB"), "it");
  assert.equal(pickLanguage(null, "it-IT"), "it");
  assert.equal(pickLanguage(undefined, "it"), "it");
  assert.equal(pickLanguage(null, "en-US"), "en");
  assert.equal(pickLanguage(null, "ita-XX"), "en");
  assert.equal(pickLanguage("garbage", undefined), "en");
});
