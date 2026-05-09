import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findTsconfig, findEslintConfig, findBudget, discoverRoutes } from "../src/discovery.ts";

function withScratch<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "audit-disc-"));
  try {
    const result = fn(dir);
    // If fn is async, defer cleanup until the promise settles.
    if (result instanceof Promise) {
      return result.finally(() => rmSync(dir, { recursive: true, force: true })) as T;
    }
    rmSync(dir, { recursive: true, force: true });
    return result;
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
}

describe("findTsconfig", () => {
  test("returns surfaceRoot/tsconfig.json when present", () => {
    withScratch((dir) => {
      writeFileSync(join(dir, "tsconfig.json"), "{}");
      expect(findTsconfig(dir)).toBe(join(dir, "tsconfig.json"));
    });
  });
  test("returns null when absent", () => {
    withScratch((dir) => {
      expect(findTsconfig(dir)).toBeNull();
    });
  });
  test("falls back to surfaceRoot/../tsconfig.json (one level up)", () => {
    withScratch((dir) => {
      const child = join(dir, "child");
      mkdirSync(child);
      writeFileSync(join(dir, "tsconfig.json"), "{}");
      expect(findTsconfig(child)).toBe(join(dir, "tsconfig.json"));
    });
  });
});

describe("findEslintConfig", () => {
  test("detects flat config (eslint.config.js) at surfaceRoot", () => {
    withScratch((dir) => {
      writeFileSync(join(dir, "eslint.config.js"), "export default [];");
      const result = findEslintConfig(dir);
      expect(result?.path).toBe(join(dir, "eslint.config.js"));
      expect(result?.format).toBe("flat");
    });
  });
  test("detects legacy .eslintrc.json at surfaceRoot", () => {
    withScratch((dir) => {
      writeFileSync(join(dir, ".eslintrc.json"), "{}");
      const result = findEslintConfig(dir);
      expect(result?.path).toBe(join(dir, ".eslintrc.json"));
      expect(result?.format).toBe("legacy");
    });
  });
  test("falls back to repo root if surfaceRoot has no config", () => {
    withScratch((dir) => {
      const child = join(dir, "child");
      mkdirSync(child);
      writeFileSync(join(dir, "eslint.config.js"), "export default [];");
      const result = findEslintConfig(child);
      expect(result?.path).toBe(join(dir, "eslint.config.js"));
    });
  });
  test("returns null when no config anywhere", () => {
    withScratch((dir) => {
      expect(findEslintConfig(dir)).toBeNull();
    });
  });
});

describe("findBudget", () => {
  test("returns surfaceRoot/budget.json when present", () => {
    withScratch((dir) => {
      writeFileSync(join(dir, "budget.json"), '{"main.js": 200000}');
      expect(findBudget(dir)).toBe(join(dir, "budget.json"));
    });
  });
  test("returns null when absent (does NOT walk up)", () => {
    withScratch((dir) => {
      expect(findBudget(dir)).toBeNull();
    });
  });
});

describe("discoverRoutes", () => {
  test("returns empty array for unknown surface", async () => {
    expect(await discoverRoutes("renderer", "/nonexistent")).toEqual([]);
  });
  test("returns array of route URLs for marketing (file-based routing)", async () => {
    await withScratch(async (dir) => {
      mkdirSync(join(dir, "src", "pages"), { recursive: true });
      writeFileSync(join(dir, "src", "pages", "index.html"), "<html></html>");
      writeFileSync(join(dir, "src", "pages", "about.html"), "<html></html>");
      const routes = await discoverRoutes("marketing", dir);
      expect(routes.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("route cache short-circuits second call", async () => {
    await withScratch(async (dir) => {
      mkdirSync(join(dir, "src", "pages"), { recursive: true });
      writeFileSync(join(dir, "src", "pages", "index.html"), "<html></html>");
      writeFileSync(join(dir, "src", "pages", "shop.html"), "<html></html>");

      const cache = new Map<import("../src/probe.ts").Surface, string[]>();

      // First call: populates cache via file-based discovery.
      const first = await discoverRoutes("marketing", dir, undefined, undefined, cache);
      expect(first.length).toBeGreaterThanOrEqual(2);
      expect(cache.has("marketing")).toBe(true);

      // Remove the pages directory so a real second crawl would return [].
      rmSync(join(dir, "src"), { recursive: true, force: true });

      // Second call: must return the cached value, not re-crawl.
      const second = await discoverRoutes("marketing", dir, undefined, undefined, cache);
      expect(second).toEqual(first);
    });
  });

  test("cache is keyed per surface — different surfaces don't share entries", async () => {
    await withScratch(async (dir) => {
      const webDir = join(dir, "webui");
      const mktDir = join(dir, "marketing");
      mkdirSync(join(webDir, "src", "pages"), { recursive: true });
      mkdirSync(join(mktDir, "src", "pages"), { recursive: true });
      writeFileSync(join(mktDir, "src", "pages", "index.html"), "<html></html>");

      const cache = new Map<import("../src/probe.ts").Surface, string[]>();

      const webRoutes = await discoverRoutes("webui", webDir, undefined, undefined, cache);
      const mktRoutes = await discoverRoutes("marketing", mktDir, undefined, undefined, cache);

      expect(cache.has("webui")).toBe(true);
      expect(cache.has("marketing")).toBe(true);
      expect(webRoutes).not.toEqual(mktRoutes);
    });
  });
});
