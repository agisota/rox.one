import type { PlaywrightRunner } from "./runners/playwright-runner.ts";

export interface CrawlInput {
  baseUrl: string;
  playwright: PlaywrightRunner;
  maxDepth: number;
  maxRoutes: number;
}

/**
 * Bounded BFS crawl from `baseUrl`. Visits every same-origin path reachable
 * via `<a href>` anchors up to `maxDepth` hops, capping the total number of
 * unique paths at `maxRoutes`.
 *
 * Returns a sorted list of pathname strings (e.g. `/`, `/about`).
 *
 * Navigation timeouts and malformed hrefs are silently skipped so a single
 * broken page does not abort the crawl.
 */
export async function crawlRoutes(input: CrawlInput): Promise<string[]> {
  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: input.baseUrl, depth: 0 }];
  const baseOrigin = new URL(input.baseUrl).origin;

  while (queue.length > 0 && seen.size < input.maxRoutes) {
    const item = queue.shift();
    if (!item) break;
    const { url, depth } = item;
    const path = new URL(url).pathname || "/";
    if (seen.has(path)) continue;
    seen.add(path);
    if (depth >= input.maxDepth) continue;

    const page = await input.playwright.newPage();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForSelector("a[href]", { timeout: 5_000 }).catch(() => undefined);
      const hrefs: string[] = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href]"));
        return anchors.map((a) => a.getAttribute("href") ?? "");
      });
      for (const href of hrefs) {
        try {
          const next = new URL(href, url);
          if (next.origin !== baseOrigin) continue;
          const nextPath = next.pathname || "/";
          if (!seen.has(nextPath)) {
            queue.push({ url: next.toString(), depth: depth + 1 });
          }
        } catch {
          // ignore malformed hrefs
        }
      }
    } catch {
      // navigation/timeout — skip this url
    } finally {
      await page.close();
    }
  }

  return Array.from(seen).sort();
}
