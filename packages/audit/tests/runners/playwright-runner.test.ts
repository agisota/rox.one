import { afterEach, describe, expect, test } from "bun:test";
import { createPlaywrightRunner, type PlaywrightRunner } from "../../src/runners/playwright-runner.ts";

let runner: PlaywrightRunner | null = null;

afterEach(async () => {
  if (runner) {
    await runner.close();
    runner = null;
  }
});

describe("createPlaywrightRunner", () => {
  test("launches a browser and provides a page context", async () => {
    runner = await createPlaywrightRunner();
    const page = await runner.newPage();
    expect(page).toBeDefined();
    await page.close();
  }, 60_000);

  test("page has fixed viewport 1440x900", async () => {
    runner = await createPlaywrightRunner();
    const page = await runner.newPage();
    expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
    await page.close();
  }, 60_000);

  test("close() shuts down the browser", async () => {
    runner = await createPlaywrightRunner();
    await runner.close();
    runner = null;
    // No assertion — just verify no exception
  }, 60_000);
});
