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
  test("returns array of route URLs for viewer (file-based routing)", async () => {
    await withScratch(async (dir) => {
      mkdirSync(join(dir, "src", "pages"), { recursive: true });
      writeFileSync(join(dir, "src", "pages", "index.html"), "<html></html>");
      writeFileSync(join(dir, "src", "pages", "about.html"), "<html></html>");
      const routes = await discoverRoutes("viewer", dir);
      expect(routes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
