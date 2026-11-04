import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const popup = read("../src/popup/popup.js");
const manifest = JSON.parse(read("../manifest.json"));

test("profile application updates captured tabs and preserves mute", () => {
  assert.match(popup, /Object\.entries\(currentState\.tabs \|\| \{\}\)/);
  assert.match(popup, /volumeForSite\(next, tab\.url\)/);
  assert.match(popup, /muted: session\.muted/);
  assert.match(popup, /type: MESSAGE\.SET_TAB_VOLUME/);
});
test("shortcut opens the extension action without extra host access", () => {
  assert.ok(manifest.permissions.includes("commands"));
  assert.ok(manifest.commands?._execute_action?.suggested_key?.default);
  assert.equal(manifest.host_permissions?.length ?? 0, 0);
});
