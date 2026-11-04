import test from "node:test";
import assert from "node:assert/strict";
import {
  clampVolume, normalizeSettings, siteKeyFromUrl,
  isRestrictedUrl, volumeForSite, withSiteVolume,
} from "../src/shared/settings.js";

test("volume input is clamped and malformed values use safe defaults", () => {
  assert.equal(clampVolume(-20), 0);
  assert.equal(clampVolume(250), 200);
  assert.equal(clampVolume(99.6), 100);
  assert.equal(clampVolume("not-a-number"), 100);
  assert.equal(clampVolume(Infinity), 100);
});
test("settings normalize malformed persisted data", () => {
  const settings = normalizeSettings({
    masterVolume: 500,
    siteVolumes: { "example.com": -5, "music.test": 155.6 },
  });
  assert.equal(settings.masterVolume, 200);
  assert.equal(settings.siteVolumes["example.com"], 0);
  assert.equal(settings.siteVolumes["music.test"], 156);
  assert.deepEqual(normalizeSettings(null), { masterVolume: 100, siteVolumes: {} });
});
test("hostnames are normalized and non-web URLs never become site preferences", () => {
  assert.equal(siteKeyFromUrl("HTTPS://Example.COM/watch"), "example.com");
  assert.equal(siteKeyFromUrl("chrome://settings"), null);
  assert.equal(siteKeyFromUrl("not a url"), null);
  assert.equal(isRestrictedUrl("chrome://settings"), true);
  assert.equal(isRestrictedUrl("https://chromewebstore.google.com/detail/abc"), true);
  assert.equal(isRestrictedUrl("https://example.com"), false);
});
test("website volumes are isolated and original settings are unchanged", () => {
  const original = normalizeSettings(null);
  const next = withSiteVolume(original, "https://EXAMPLE.com/watch", 75);
  assert.equal(volumeForSite(next, "https://example.com/another"), 75);
  assert.equal(volumeForSite(next, "https://different.example"), 100);
  assert.deepEqual(original.siteVolumes, {});
  assert.equal(withSiteVolume(next, "chrome://settings", 20).siteVolumes["example.com"], 75);
});
