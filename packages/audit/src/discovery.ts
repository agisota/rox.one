import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Surface } from "./probe.ts";
import { crawlRoutes } from "./route-crawler.ts";
import type { PlaywrightRunner } from "./runners/playwright-runner.ts";

const TSCONFIG_NAMES = ["tsconfig.json"];
const ESLINT_FLAT = ["eslint.config.js", "eslint.config.mjs", "eslint.config.ts"];
const ESLINT_LEGACY = [".eslintrc.json", ".eslintrc.js", ".eslintrc"];

export function findTsconfig(surfaceRoot: string): string | null {
  for (const name of TSCONFIG_NAMES) {
    const p = join(surfaceRoot, name);
    if (existsSync(p)) return p;
  }
  // Fall back one directory up (e.g., apps/electron/src/renderer ← apps/electron/tsconfig.json)
  const parent = dirname(surfaceRoot);
  if (parent !== surfaceRoot) {
    for (const name of TSCONFIG_NAMES) {
      const p = join(parent, name);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

export type EslintFormat = "flat" | "legacy";
export interface EslintConfigDiscovery {
  path: string;
  format: EslintFormat;
}

export function findEslintConfig(surfaceRoot: string): EslintConfigDiscovery | null {
  for (const name of ESLINT_FLAT) {
    const p = join(surfaceRoot, name);
    if (existsSync(p)) return { path: p, format: "flat" };
  }
  for (const name of ESLINT_LEGACY) {
    const p = join(surfaceRoot, name);
    if (existsSync(p)) return { path: p, format: "legacy" };
  }
  // Walk up to repo root looking for either format
  let cur = dirname(surfaceRoot);
  while (cur !== dirname(cur)) {
    for (const name of ESLINT_FLAT) {
      const p = join(cur, name);
      if (existsSync(p)) return { path: p, format: "flat" };
    }
    for (const name of ESLINT_LEGACY) {
      const p = join(cur, name);
      if (existsSync(p)) return { path: p, format: "legacy" };
    }
    cur = dirname(cur);
  }
  return null;
}

export function findBudget(surfaceRoot: string): string | null {
  const p = join(surfaceRoot, "budget.json");
  return existsSync(p) ? p : null;
}

export async function discoverRoutes(
  surface: Surface,
  surfaceRoot: string,
  liveUrl?: string,
  playwright?: PlaywrightRunner,
  cache?: Map<Surface, string[]>,
): Promise<string[]> {
  // Return cached result immediately if available — avoids double-crawl when
  // multiple probes (e.g. runtime-axe + runtime-states) run against the same surface.
  const cached = cache?.get(surface);
  if (cached !== undefined) return cached;

  let result: string[];

  // A.4: when a live dev-server URL and a Playwright runner are both available,
  // crawl the live SPA. This is the only way to enumerate routes for SPAs whose
  // routing is defined in JS (e.g. React Router) rather than as static .html files.
  if (liveUrl && playwright) {
    result = await crawlRoutes({ baseUrl: liveUrl, playwright, maxDepth: 2, maxRoutes: 20 });
  } else {
    // A.2 fallback: file-based routes from <surfaceRoot>/src/pages/*.html.
    const pagesDir = join(surfaceRoot, "src", "pages");
    if (!existsSync(pagesDir)) {
      result = [];
    } else {
      try {
        const entries = readdirSync(pagesDir);
        result = entries
          .filter((name) => name.endsWith(".html") && statSync(join(pagesDir, name)).isFile())
          .map((name) => `/${name === "index.html" ? "" : name.replace(/\.html$/, "")}`);
      } catch {
        result = [];
      }
    }
  }

  cache?.set(surface, result);
  return result;
}
