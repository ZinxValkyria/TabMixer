import test from "node:test";
import assert from "node:assert/strict";
import { clampVolume, isRestrictedUrl, normalizeSettings, siteKeyFromUrl, volumeForSite, withSiteVolume } from "../src/shared/settings.js";

test("clampVolume constrains and rounds volume", () => {
  assert.equal(clampVolume(-4), 0);
  assert.equal(clampVolume(72.6), 73);
  assert.equal(clampVolume(900), 200);
  assert.equal(clampVolume("bad"), 100);
});

test("site keys are limited to regular web origins", () => {
  assert.equal(siteKeyFromUrl("https://Music.Example.com/watch?v=1"), "music.example.com");
  assert.equal(siteKeyFromUrl("chrome://settings"), null);
  assert.equal(siteKeyFromUrl("not a url"), null);
});

test("restricted URLs are detected without throwing", () => {
  assert.equal(isRestrictedUrl("https://example.com"), false);
  assert.equal(isRestrictedUrl("file:///C:/track.html"), false);
  assert.equal(isRestrictedUrl("edge://extensions"), true);
  assert.equal(isRestrictedUrl("https://chromewebstore.google.com/detail/example/abc"), true);
  assert.equal(isRestrictedUrl(undefined), true);
});

test("site volume is immutable and persistent by hostname", () => {
  const original = normalizeSettings(null);
  const next = withSiteVolume(original, "https://example.com/a", 42);
  assert.deepEqual(original.siteVolumes, {});
  assert.equal(volumeForSite(next, "https://example.com/b"), 42);
});

test("normalization drops malformed site data", () => {
  const normalized = normalizeSettings({ masterVolume: 250, siteVolumes: { "example.com": -1, ["x".repeat(254)]: 50 } });
  assert.equal(normalized.masterVolume, 200);
  assert.deepEqual(normalized.siteVolumes, { "example.com": 0 });
});
