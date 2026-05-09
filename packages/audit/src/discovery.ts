import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Surface } from "./probe.ts";

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

export function discoverRoutes(_surface: Surface, surfaceRoot: string): string[] {
  // Phase A.2 minimum: file-based routes from <surfaceRoot>/src/pages/*.html.
  // Per-surface custom discovery extensions land in A.4.
  const pagesDir = join(surfaceRoot, "src", "pages");
  if (!existsSync(pagesDir)) return [];
  try {
    const entries = readdirSync(pagesDir);
    return entries
      .filter((name) => name.endsWith(".html") && statSync(join(pagesDir, name)).isFile())
      .map((name) => `/${name === "index.html" ? "" : name.replace(/\.html$/, "")}`);
  } catch {
    return [];
  }
}
