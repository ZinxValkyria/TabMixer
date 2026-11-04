import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manifest = JSON.parse(read("../manifest.json"));
const popup = read("../src/popup/popup.js");
const worker = read("../src/service-worker.js");

test("extension permissions remain least privilege", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.host_permissions?.length ?? 0, 0);
  assert.equal(manifest.content_security_policy?.extension_pages, undefined);
  const allowed = new Set(["tabs", "tabCapture", "offscreen", "storage"]);
  for (const permission of manifest.permissions ?? []) {
    assert.ok(allowed.has(permission), `Unexpected permission: ${permission}`);
  }
});

test("popup does not inject tab titles as HTML", () => {
  assert.match(popup, /title\.textContent\s*=\s*tab\.title/);
  assert.doesNotMatch(popup, /\.innerHTML\s*=/);
  assert.doesNotMatch(popup, /\beval\s*\(/);
});

test("audio capture is requested only on explicit mixer action", () => {
  assert.match(worker, /case MESSAGE\.SET_TAB_VOLUME:/);
  assert.match(worker, /chrome\.tabCapture\.getMediaStreamId/);
  assert.doesNotMatch(worker, /chrome\.tabs\.onUpdated\.addListener\([^]*?captureTab\(/);
});
