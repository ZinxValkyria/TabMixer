import { test, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("extension popup loads and can save a mix profile", async () => {
  const extensionPath = resolve(".");
  const userDataDir = await mkdtemp(join(tmpdir(), "tabmixer-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await expect(page.getByRole("heading", { name: "TabMixer" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Quiet/ })).toBeVisible();
    await page.locator("#profile-name").fill("Gaming");
    await page.locator("#profile-save").click();
    await expect(page.locator("#profile-select")).toHaveValue("Gaming");
    await page.reload();
    await expect(page.locator("#profile-select")).toHaveValue("Gaming");
    await expect(page.locator("#profile-apply")).toBeEnabled();
  } finally {
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
