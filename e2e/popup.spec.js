import { test, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("extension popup loads and can save a mix profile", async () => {
  test.setTimeout(60_000);
  const extensionPath = resolve(".");
  const userDataDir = await mkdtemp(join(tmpdir(), "tabmixer-e2e-"));
  let context;
  try {
    context = await test.step("Launch extension-enabled Chromium", async () =>
      chromium.launchPersistentContext(userDataDir, {
        channel: "chromium", // Playwright's bundled Chromium supports extensions in headless mode.
        headless: true,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      }),
    );

    const worker = await test.step("Wait for extension service worker", async () => {
      const existing = context.serviceWorkers().find((w) =>
        w.url().startsWith("chrome-extension://"),
      );
      if (existing) return existing;
      try {
        return await context.waitForEvent("serviceworker", {
          predicate: (w) => w.url().startsWith("chrome-extension://"),
          timeout: 15_000,
        });
      } catch (error) {
        throw new Error(
          "TabMixer extension service worker did not start within 15 seconds. " +
            "Check Chromium extension loading and manifest/background script errors.",
          { cause: error },
        );
      }
    });

    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await test.step("Open extension popup", async () => {
      await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { name: "TabMixer" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Quiet/ })).toBeVisible();
    });

    await test.step("Save and reload mix profile", async () => {
      await page.locator("#profile-name").fill("Gaming");
      await page.locator("#profile-save").click();
      await expect(page.locator("#profile-select")).toHaveValue("Gaming");
      await page.reload();
      await expect(page.locator("#profile-select")).toHaveValue("Gaming");
      await expect(page.locator("#profile-apply")).toBeEnabled();
    });
  } finally {
    if (context) await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
});
