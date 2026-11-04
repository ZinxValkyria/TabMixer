import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../src/popup/popup.html", import.meta.url), "utf8");
const js = readFileSync(new URL("../src/popup/popup.js", import.meta.url), "utf8");
test("quick presets are present with valid supported volumes", () => {
  for (const volume of [25, 100, 150]) assert.match(html, new RegExp('data-volume="' + volume + '"'));
  assert.match(html, /role="group" aria-label="Master volume presets"/);
});
test("presets use the existing master volume message and persist settings", () => {
  assert.match(js, /querySelectorAll\("\.preset-button"\)/);
  assert.match(js, /type: MESSAGE\.SET_MASTER_VOLUME, volume/);
  assert.match(js, /saveSettings\(\{ \.\.\.settings, masterVolume: volume \}\)/);
});
