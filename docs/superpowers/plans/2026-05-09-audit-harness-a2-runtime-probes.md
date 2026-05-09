# Audit Harness — Phase A.2 Runtime Probes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the A.2 runtime probe family to the audit harness: `playwright-runner` shared infrastructure, `runtime-axe` probe (per-route axe-core via Playwright), and `runtime-states` probe (asserts every interactive component renders empty/loading/error variants). Also: refine probe-discovery for surfaces whose configs aren't at the default `surfaceRoot` path (the gap that caused A.1's first run to produce 0 findings).

**Architecture:** Each runtime probe imports `playwright-runner.ts` for browser lifecycle (deterministic clock, viewport, fonts, `prefers-reduced-motion: reduce`). `runtime-axe` walks each surface's discoverable routes and runs `@axe-core/playwright` per route, emitting WCAG 2.2 AA findings. `runtime-states` exercises interactive components and asserts the documented set of states (idle/hover/focus/disabled/loading/error/empty) is reachable.

**Tech Stack:** Bun 1.3.13, TypeScript 5.9 (strict), `playwright` (already in `apps/electron`'s test deps; reuse via workspace), `@axe-core/playwright`, `bun:test`. Add `playwright-electron` if testing the renderer surface specifically. Total new prod deps: 1 (`@axe-core/playwright`).

**Reference:** Spec `docs/superpowers/specs/2026-05-09-audit-harness-design.md`. AGENTS.md TDD operating contract is mandatory.

**Tickets:** T139 (playwright-runner), T140 (runtime-axe + fixture), T141 (runtime-states + fixture), T142 (probe-discovery refinement, addressing A.1's 0-findings gap), T143 (T139–T142 bundled docs + first A.2 audit run).

**Branch policy:** All work on `feat/audit-a2-runtime`, branched from `feat/audit-a1-static`. One commit per task. Same per-commit identity flags. PR opens against `main` after architect verification.

---

## File Structure

### Created in this phase

| Path | Responsibility |
|---|---|
| `packages/audit/src/runners/playwright-runner.ts` | Shared Playwright lifecycle: launch, page, deterministic config |
| `packages/audit/src/probes/runtime-axe.ts` | A.2 axe-core probe |
| `packages/audit/src/probes/runtime-states.ts` | A.2 component-state coverage probe |
| `packages/audit/src/discovery.ts` | Surface-config discovery (tsconfig, eslint, budget paths) — fixes A.1 gap |
| `packages/audit/tests/runners/playwright-runner.test.ts` | Lifecycle + config tests |
| `packages/audit/tests/probes/runtime-axe.test.ts` | Probe vs `axe-broken/` fixture |
| `packages/audit/tests/probes/runtime-states.test.ts` | Probe vs `states-broken/` fixture |
| `packages/audit/tests/discovery.test.ts` | Per-surface discovery cases |
| `packages/audit/tests/fixtures/axe-broken/` | Hermetic page with known WCAG violations |
| `packages/audit/tests/fixtures/states-broken/` | Component missing loading/error states |
| `docs/tickets/T139-T143-*.md` | 5 AGENTS.md tickets |
| `docs/worklog/T139-T143-*.md` | 5 worklogs (11-section format) |

### Modified

- `packages/audit/package.json` — add `@axe-core/playwright` dep, `playwright` devDep
- `packages/audit/src/probe.ts` — add optional `playwright?: PlaywrightInstance` to `ProbeContext` (was already declared in spec § 4.3 but commented out for A.1; activate for A.2)
- `packages/audit/src/cli.ts` — register `runtimeAxeProbe`, `runtimeStatesProbe`; populate `playwright` field in context when those probes are selected
- `packages/audit/src/probes/static-tsc.ts` — use `discovery.findTsconfig(surfaceRoot)` instead of hardcoded `<surfaceRoot>/tsconfig.json`
- `packages/audit/src/probes/static-eslint.ts` — use `discovery.findEslintConfig(surfaceRoot)`
- `packages/audit/src/probes/static-bundle.ts` — use `discovery.findBudget(surfaceRoot)`
- `bun.lock` — refreshed for new deps

---

## Task 1 — Add `@axe-core/playwright` + playwright dep

- [ ] **Step 1:** Modify `packages/audit/package.json`. In `dependencies`, add `"@axe-core/playwright": "4.10.2"` (current latest stable). In `devDependencies`, add `"playwright": "1.49.1"` (matching the version `apps/electron` already uses; check via `cat apps/electron/package.json | jq '.dependencies.playwright // .devDependencies.playwright'`).

- [ ] **Step 2:** Run from repo root: `~/.bun/bin/bun install`. Verify installation.

- [ ] **Step 3:** `cd packages/audit && ~/.bun/bin/bun run typecheck` — exit 0.

- [ ] **Step 4:** Commit:
```bash
cd /home/dev/craft/rox-one-terminal
git add packages/audit/package.json bun.lock
git -c user.name="Mark Lindgreen" -c user.email="mark@agisota.com" commit -m "chore(audit): add @axe-core/playwright + playwright deps for A.2 [T139]"
```

---

## Task 2 — Surface discovery module (TDD; addresses A.1 0-findings gap)

A.1's first run produced 0 findings because the static probes hardcoded `<surfaceRoot>/tsconfig.json`, `<surfaceRoot>/budget.json`, etc., but real surfaces don't all conform. This module centralizes discovery.

- [ ] **Step 1:** Write `packages/audit/tests/discovery.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findTsconfig, findEslintConfig, findBudget, discoverRoutes } from "../src/discovery.ts";

function withScratch<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "audit-disc-"));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
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
  test("returns empty array for unknown surface", () => {
    expect(discoverRoutes("renderer", "/nonexistent")).toEqual([]);
  });
  test("returns array of route URLs for marketing (file-based routing)", () => {
    withScratch((dir) => {
      mkdirSync(join(dir, "src", "pages"), { recursive: true });
      writeFileSync(join(dir, "src", "pages", "index.html"), "<html></html>");
      writeFileSync(join(dir, "src", "pages", "about.html"), "<html></html>");
      const routes = discoverRoutes("marketing", dir);
      expect(routes.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

- [ ] **Step 2:** Run: `cd packages/audit && ~/.bun/bin/bun test tests/discovery.test.ts` — expect FAIL.

- [ ] **Step 3:** Implement `packages/audit/src/discovery.ts`:

```typescript
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

export function discoverRoutes(surface: Surface, surfaceRoot: string): string[] {
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
```

- [ ] **Step 4:** Run tests — expect ≥9 pass.

- [ ] **Step 5:** Commit:
```
feat(audit): surface discovery module with fallback paths [T142]
```

---

## Task 3 — Update existing static probes to use discovery

- [ ] **Step 1:** Modify `packages/audit/src/probes/static-tsc.ts`. Replace `const tsconfigPath = join(ctx.surfaceRoot, "tsconfig.json");` with `const tsconfigPath = findTsconfig(ctx.surfaceRoot);`. Add import of `findTsconfig`. Adjust the `if (!existsSync(tsconfigPath)) return [];` check to handle the `null` return.

- [ ] **Step 2:** Modify `packages/audit/src/probes/static-eslint.ts`. Replace the per-name candidate-file loop with `const found = findEslintConfig(ctx.surfaceRoot);`. Use `found.format` to decide CLI args (flat vs legacy).

- [ ] **Step 3:** Modify `packages/audit/src/probes/static-bundle.ts`. Replace `readBudget(ctx.surfaceRoot)` to use `findBudget` from discovery.

- [ ] **Step 4:** Run all probe tests — must still pass (the discovery functions return the same values for the existing fixtures).

- [ ] **Step 5:** Run a real audit: `bun run audit run renderer,webui,viewer,marketing --probes=static-*`. Now expect non-zero findings (probes find the surface tsconfigs / eslint configs that exist one level up).

- [ ] **Step 6:** Commit:
```
fix(audit): use discovery module in static probes — closes A.1 0-findings gap [T142]
```

---

## Task 4 — playwright-runner shared infra (TDD)

- [ ] **Step 1:** Write `packages/audit/tests/runners/playwright-runner.test.ts`:

```typescript
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
  });

  test("page has fixed viewport 1440×900", async () => {
    runner = await createPlaywrightRunner();
    const page = await runner.newPage();
    expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
    await page.close();
  });

  test("close() shuts down the browser", async () => {
    runner = await createPlaywrightRunner();
    await runner.close();
    runner = null;
    // No assertion — just verify no exception
  });
});
```

- [ ] **Step 2:** Run — expect FAIL.

- [ ] **Step 3:** Implement `packages/audit/src/runners/playwright-runner.ts`:

```typescript
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
  // Freeze Date.now via clock control for determinism
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
```

- [ ] **Step 4:** Run tests — expect 3 pass.

- [ ] **Step 5:** Commit:
```
feat(audit): playwright-runner with deterministic viewport, clock, motion [T139]
```

---

## Task 5 — runtime-axe probe + fixture (TDD)

- [ ] **Step 1:** Create fixture `packages/audit/tests/fixtures/axe-broken/`:
  - `package.json` (private)
  - `index.html` with 3 known WCAG violations: missing `<title>`, button without accessible name, image without alt

```html
<!doctype html>
<html lang="en">
  <body>
    <button></button>
    <img src="x.png">
    <p>Missing title and lang issues; button name; image alt</p>
  </body>
</html>
```

- [ ] **Step 2:** Write `packages/audit/tests/probes/runtime-axe.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runtimeAxeProbe } from "../../src/probes/runtime-axe.ts";
import { createPlaywrightRunner } from "../../src/runners/playwright-runner.ts";
import type { ProbeContext } from "../../src/probe.ts";

const FIXTURE = join(import.meta.dir, "..", "fixtures", "axe-broken");

describe("runtime-axe probe", () => {
  test("metadata", () => {
    expect(runtimeAxeProbe.name).toBe("runtime-axe");
    expect(runtimeAxeProbe.phase).toBe("A.2");
    expect(runtimeAxeProbe.applicableTo("renderer")).toBe(true);
  });

  test("detects WCAG violations on fixture page", async () => {
    const playwright = await createPlaywrightRunner();
    const ctx: ProbeContext = {
      surface: "marketing",
      workspaceRoot: FIXTURE,
      surfaceRoot: FIXTURE,
      playwright,
      timeoutMs: 60_000,
    } as ProbeContext;
    try {
      const findings = await runtimeAxeProbe.run(ctx);
      expect(findings.length).toBeGreaterThanOrEqual(2);
      const rules = findings.map((f) => f.rule);
      expect(rules.some((r) => r.startsWith("axe:"))).toBe(true);
    } finally {
      await playwright.close();
    }
  }, 30_000);
});
```

- [ ] **Step 3:** Implement `packages/audit/src/probes/runtime-axe.ts`. Use `@axe-core/playwright` to run axe-core against each route discovered via `discoverRoutes(ctx.surface, ctx.surfaceRoot)`. For the fixture which is a single file, special-case: if `discoverRoutes` returns empty AND `<surfaceRoot>/index.html` exists, audit it as a single page via `file://` URL.

```typescript
import AxeBuilder from "@axe-core/playwright";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { discoverRoutes } from "../discovery.ts";
import type { Finding, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

function severityForImpact(impact: string | null | undefined): Finding["severity"] {
  switch (impact) {
    case "critical": return "critical";
    case "serious":  return "high";
    case "moderate": return "medium";
    default:         return "low";
  }
}

export const runtimeAxeProbe: Probe = {
  name: "runtime-axe",
  phase: "A.2",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    if (!ctx.playwright) return [];
    const routes = discoverRoutes(ctx.surface, ctx.surfaceRoot);
    const indexFile = join(ctx.surfaceRoot, "index.html");
    if (routes.length === 0 && !existsSync(indexFile)) return [];

    const findings: Finding[] = [];
    const now = new Date().toISOString();

    const targets = routes.length > 0
      ? routes.map((r) => `file://${ctx.surfaceRoot}/src/pages${r === "/" ? "/index" : r}.html`)
      : [`file://${indexFile}`];

    for (const url of targets) {
      const page = await ctx.playwright.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle" });
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
        for (const v of results.violations) {
          for (const node of v.nodes) {
            const target = node.target.join(" ");
            const id = computeFindingId({
              probe: "runtime-axe",
              rule: `axe:${v.id}`,
              file: url,
              line: 0,
            });
            findings.push({
              schemaVersion: FINDING_SCHEMA_VERSION,
              id,
              probe: "runtime-axe",
              surface: ctx.surface,
              phase: "A.2",
              severity: severityForImpact(v.impact),
              rule: `axe:${v.id}`,
              location: { file: url, selector: target },
              message: v.description,
              evidence: { codeSnippet: node.html },
              suggestedFix: v.help,
              confidence: 1,
              vdiImpact: { quality: 0.7, risk: 0.5, readiness: 0.6 },
              firstSeen: now,
              lastSeen: now,
            });
          }
        }
      } finally {
        await page.close();
      }
    }

    return findings;
  },
};
```

- [ ] **Step 4:** Wire into `cli.ts`: import `runtimeAxeProbe`, append to `probeModules`. Also: when ANY probe in the run has `phase: "A.2"`, instantiate the playwright runner and inject into `ProbeContext.playwright`. Update CLI's `contextFor` callback accordingly.

- [ ] **Step 5:** Run tests. The fixture test may take 5–15 seconds for the first browser launch.

- [ ] **Step 6:** Commit:
```
feat(audit): runtime-axe probe + fixture (WCAG 2.2 AA via @axe-core/playwright) [T140]
```

---

## Task 6 — runtime-states probe + fixture (TDD)

- [ ] **Step 1:** Create fixture `packages/audit/tests/fixtures/states-broken/index.html`:
  - A button with no disabled state CSS
  - A list with no empty-state markup
  - A form with no error-state markup

- [ ] **Step 2:** Write `packages/audit/tests/probes/runtime-states.test.ts` with 2 cases (metadata + detects missing states).

- [ ] **Step 3:** Implement `packages/audit/src/probes/runtime-states.ts`. Heuristics:
  - For each interactive element (`button`, `a[href]`, `input`, `select`, `textarea`), assert there exists at least one CSS rule mentioning `:hover`, `:focus`, or `:disabled` (via `getComputedStyle` probing).
  - For each list (`ul`, `ol`, `[role=list]`), assert it has at least one child OR a sibling element with class containing "empty"/"no-results".
  - For each form, assert there's a way to surface validation errors (e.g., `[aria-invalid]`, `[role=alert]`, classes like "error"/"invalid").
  - Heuristic — not exhaustive. Probe emits findings with `confidence: 0.7` (less than 1) to acknowledge heuristic nature.

- [ ] **Step 4:** Wire into CLI. Run tests.

- [ ] **Step 5:** Commit:
```
feat(audit): runtime-states probe heuristic check for empty/loading/error states [T141]
```

---

## Task 7 — First A.2 audit run + INDEX.md row

- [ ] **Step 1:** Run: `bun run audit run renderer,webui,viewer,marketing --probes=runtime-*`. Capture findings count + ticket count.

- [ ] **Step 2:** Append a row to `docs/audits/INDEX.md` with the run timestamp + counts.

- [ ] **Step 3:** Commit:
```
feat(audit): first A.2 runtime audit run [T143]
```

---

## Task 8 — T139–T143 tickets + worklogs

- [ ] **Step 1:** Create 5 ticket files in `docs/tickets/T139-*.md` through `T143-*.md`. Match the AGENTS.md ticket format: Summary, Acceptance Criteria, TDD Test Shape, Files Affected.

- [ ] **Step 2:** Create 5 worklog files in `docs/worklog/T139-*.md` through `T143-*.md` with the 11-section AGENTS.md format.

- [ ] **Step 3:** Commit:
```
docs(audit): T139-T143 tickets + worklogs for A.2 runtime probes
```

---

## Task 9 — Acceptance gate verification

- [ ] **Step 1:** Run `cd packages/audit && bun test` — expect all green (existing 48 + new ~10 = ~58).
- [ ] **Step 2:** Run `bun run typecheck:all` — exit 0.
- [ ] **Step 3:** Dispatch architect agent for separate-context verification (per spec § 14).
- [ ] **Step 4:** Open PR `feat/audit-a2-runtime` → `main`.

---

## Out of scope for A.2 (deferred)

- Per-route screenshot capture for the LLM taste pass (A.3).
- E2E user flows (A.4).
- Composer / Experience screen probes (B / C).

## Self-review

**Spec coverage:**
- Plan addresses spec § 11.2 (A.2 acceptance gate: runtime probes green, queue grows with axe-core findings, no Playwright flakes).
- Plan addresses A.1's 0-findings gap (Task 2 + 3 — surface discovery module).
- All A.2 tickets mapped (T139 playwright-runner, T140 runtime-axe, T141 runtime-states, T142 discovery, T143 docs+first-run).

**Type consistency:** `Probe` interface unchanged. `ProbeContext.playwright` is the new optional field, populated by CLI when an A.2+ probe is selected. `Finding` type unchanged (schemaVersion 1 still covers).

**Plan dependencies (Task DAG):**
- Task 1 (deps) → Task 2 (discovery) → Task 3 (probe rewrites) → Task 4 (playwright-runner) → Task 5 (runtime-axe, depends on 4 + 2) → Task 6 (runtime-states, depends on 4) → Task 7 (first run, depends on 5+6) → Task 8 (docs) → Task 9 (verification).
- Tasks 5 and 6 are independent and could parallelize, but in sequential subagent-driven execution we keep them serial to avoid CLI registration conflicts.
