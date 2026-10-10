import test from "node:test";
import assert from "node:assert/strict";
import { mergePolare } from "./polare.ts";

const img = { type: "image", url: "/api/media/abc" };
const vid = { type: "video", url: "https://x.public.blob.vercel-storage.com/a.mp4" };
const base = { kind: "REEL", caption: "", media: [vid], externalUrl: null, published: true, pinned: false };

test("changing kind alone is checked against the stored media", () => {
  assert.equal(mergePolare(base, { kind: "IMAGE" }).success, false);
  assert.equal(mergePolare(base, { kind: "REEL", caption: "hi" }).success, true);
});

test("changing media alone is checked against the stored kind", () => {
  assert.equal(mergePolare(base, { media: [img] }).success, false);
  assert.equal(mergePolare({ ...base, kind: "CAROUSEL", media: [img, img] }, { media: [img] }).success, false);
  assert.equal(mergePolare({ ...base, kind: "CAROUSEL", media: [img, img] }, { media: [img, vid, img] }).success, true);
});

test("a malformed stored media list is rejected, not saved", () => {
  assert.equal(mergePolare({ ...base, media: "oops" }, { caption: "x" }).success, false);
});
