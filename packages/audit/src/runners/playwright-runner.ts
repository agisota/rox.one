import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface PlaywrightRunner {
  newPage(): Promise<Page>;
  close(): Promise<void>;
}

export async function createPlaywrightRunner(): Promise<PlaywrightRunner> {
  const browser: Browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
  });
  // Freeze Date.now via init script for determinism
  await context.addInitScript(() => {
    const FROZEN = new Date("2026-05-09T00:00:00.000Z").getTime();
    Date.now = () => FROZEN;
  });

  return {
    async newPage() {
      return await context.newPage();
    },
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
