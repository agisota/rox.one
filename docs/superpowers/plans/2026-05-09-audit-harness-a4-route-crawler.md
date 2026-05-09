# Audit Harness — Phase A.4 Route Crawler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add SPA route discovery (and the dev-server lifecycle to make it possible) so `runtime-axe` and `runtime-states` produce real findings against the four user-facing UIs. This is the blocker the A.2 architect-verification surfaced and the prerequisite for A.3's LLM taste pass.

**Architecture re-decision:** The original spec ordered A.3 (LLM taste) before A.4 (E2E flows), but A.2's architect verification proved A.3's value is gated on A.4's route discovery. **Phase order is now A.1 → A.2 → A.4 (this plan) → A.3 → done with sub-project A**. The 5-flow E2E coverage from the original A.4 plan moves to a follow-on **A.5** spec — A.4 here scopes only to route crawling so A.3 can proceed.

**Tech Stack:** Bun + Playwright (already in deps). New: dev-server lifecycle helper using `node:child_process` + URL probing. No new prod deps.

**Tickets:** T145 (dev-server runner), T146 (SPA route crawler), T147 (discoverRoutes integration), T148 (first A.4 audit + INDEX row).

**Branch:** `feat/audit-a4-e2e-flows`.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `packages/audit/src/runners/dev-server-runner.ts` | Spawn/kill a dev server per surface; return live URL |
| `packages/audit/src/route-crawler.ts` | Live-server crawl: BFS from base URL, follow same-origin anchor refs, bounded depth + count |
| `packages/audit/tests/runners/dev-server-runner.test.ts` | Lifecycle + ready-pattern tests |
| `packages/audit/tests/route-crawler.test.ts` | Crawl test against `spa-fixture/` |
| `packages/audit/tests/fixtures/spa-fixture/` | Minimal Vite + React Router project (3 routes) |

### Modified

| Path | Change |
|---|---|
| `packages/audit/src/discovery.ts` | `discoverRoutes` becomes async, accepts optional `liveUrl` + `playwright` params; uses crawler when both set |
| `packages/audit/src/probes/runtime-axe.ts` | `await discoverRoutes(...)`, use `ctx.devServerUrl`, populate `location.route` |
| `packages/audit/src/probes/runtime-states.ts` | Same async update |
| `packages/audit/src/probe.ts` | Add optional `devServerUrl?: string` to `ProbeContext` |
| `packages/audit/src/cli.ts` | When any A.2+ probe selected, spawn dev servers in parallel; pass URLs via context; cleanup in finally |

---

## Task 1 — Dev-server runner (TDD)

- [ ] **Step 1: Failing test** at `packages/audit/tests/runners/dev-server-runner.test.ts`:

```typescript
import { afterEach, describe, expect, test } from "bun:test";
import { spawnDevServer, type DevServerHandle } from "../../src/runners/dev-server-runner.ts";

let handle: DevServerHandle | null = null;
afterEach(async () => { if (handle) { await handle.kill(); handle = null; } });

describe("spawnDevServer", () => {
  test("rejects when ready line never appears within timeout", async () => {
    await expect(spawnDevServer({
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000)"],
      cwd: process.cwd(),
      readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
      timeoutMs: 500,
    })).rejects.toThrow(/timeout/);
  });

  test("resolves with URL when ready pattern matches", async () => {
    handle = await spawnDevServer({
      command: "node",
      args: ["-e", "console.log('Local: http://localhost:9999/'); setInterval(() => {}, 1000);"],
      cwd: process.cwd(),
      readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
      timeoutMs: 5000,
    });
    expect(handle.url).toBe("http://localhost:9999/");
  });

  test("kill() terminates the spawned process", async () => {
    handle = await spawnDevServer({
      command: "node",
      args: ["-e", "console.log('Local: http://localhost:9998/'); setInterval(() => {}, 1000);"],
      cwd: process.cwd(),
      readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
      timeoutMs: 5000,
    });
    await handle.kill();
    handle = null;
  });
});
```

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `packages/audit/src/runners/dev-server-runner.ts`** — uses `node:child_process` `spawn`, listens to stdout/stderr for ready pattern, returns `{ url, pid, kill() }`. SIGTERM-then-SIGKILL kill semantics.

- [ ] **Step 4: Tests pass (3 cases).**

- [ ] **Step 5: Commit** — `feat(audit): dev-server-runner with ready-pattern detection [T145]`

---

## Task 2 — SPA fixture + route crawler (TDD)

- [ ] **Step 1: Create SPA fixture** at `packages/audit/tests/fixtures/spa-fixture/` with package.json (`vite`, `react-router-dom`), `vite.config.ts`, `index.html`, and `src/main.tsx` containing 3 routes: `/`, `/about`, `/contact` linked via `<Link to="...">`.

The fixture should run with `bun run dev` (port 5174) and print Vite's standard ready line.

- [ ] **Step 2: Install fixture deps** — `cd packages/audit/tests/fixtures/spa-fixture && bun install`. Mark as a non-workspace package (no `name` registered in workspaces glob).

- [ ] **Step 3: Failing test** at `packages/audit/tests/route-crawler.test.ts`:

```typescript
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { spawnDevServer, type DevServerHandle } from "../src/runners/dev-server-runner.ts";
import { crawlRoutes } from "../src/route-crawler.ts";
import { createPlaywrightRunner, type PlaywrightRunner } from "../src/runners/playwright-runner.ts";

const FIXTURE = join(import.meta.dir, "fixtures", "spa-fixture");
let server: DevServerHandle;
let pw: PlaywrightRunner;

beforeAll(async () => {
  server = await spawnDevServer({
    command: "bun",
    args: ["run", "dev"],
    cwd: FIXTURE,
    readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
    timeoutMs: 30000,
  });
  pw = await createPlaywrightRunner();
}, 60000);

afterAll(async () => {
  await pw?.close();
  await server?.kill();
});

describe("crawlRoutes", () => {
  test("discovers /, /about, /contact from SPA fixture", async () => {
    const routes = await crawlRoutes({ baseUrl: server.url, playwright: pw, maxDepth: 2, maxRoutes: 20 });
    expect(routes).toContain("/");
    expect(routes).toContain("/about");
    expect(routes).toContain("/contact");
  });
});
```

- [ ] **Step 4: Implement `packages/audit/src/route-crawler.ts`**

```typescript
import type { PlaywrightRunner } from "./runners/playwright-runner.ts";

export interface CrawlInput {
  baseUrl: string;
  playwright: PlaywrightRunner;
  maxDepth: number;
  maxRoutes: number;
}

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
      await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      // Use page.evaluate to extract anchor hrefs in a single round-trip
      const hrefs: string[] = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a[href]"));
        return anchors.map((a) => a.getAttribute("href") || "");
      });
      for (const href of hrefs) {
        try {
          const next = new URL(href, url);
          if (next.origin !== baseOrigin) continue;
          const nextPath = next.pathname || "/";
          if (!seen.has(nextPath)) queue.push({ url: next.toString(), depth: depth + 1 });
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
```

- [ ] **Step 5: Tests pass.**

- [ ] **Step 6: Commit** — `feat(audit): SPA route crawler with bounded BFS [T146]`

---

## Task 3 — discoverRoutes integration

- [ ] **Step 1: Modify `packages/audit/src/discovery.ts`.** Update `discoverRoutes` signature to accept optional `liveUrl` + `playwright`. When both present, return `crawlRoutes(...)`. Otherwise, existing file-based logic. Function becomes async.

- [ ] **Step 2: Update `packages/audit/src/probe.ts`** — add optional `devServerUrl?: string` to `ProbeContext`.

- [ ] **Step 3: Update `runtime-axe.ts` and `runtime-states.ts`** — `await discoverRoutes(surface, surfaceRoot, ctx.devServerUrl, ctx.playwright)`. Populate `location.route` field per finding.

- [ ] **Step 4: Update `cli.ts`** — surface→devCommand map:
  - `webui` → `bun run webui:dev`
  - `viewer` → `bun run viewer:dev`
  - `marketing` → `bun run marketing:dev`
  - `renderer` → skip dev server (Electron renderer needs full Electron app, deferred to A.5)

  When any A.2+ probe is selected, spawn dev servers for each in-scope surface in parallel via `Promise.all`. Pass each URL via `contextFor` callback's `devServerUrl` field. In `finally`, kill all servers.

- [ ] **Step 5: Run existing test suite — must still pass.** The fixture-based tests don't use `devServerUrl` so they continue to work via file-based fallback.

- [ ] **Step 6: Real-world spot check:**
```bash
~/.bun/bin/bun run packages/audit/src/cli.ts run webui --probes=runtime-axe --no-tickets --out=/tmp/a4-spot
```
Expect the dev server to spawn, route crawl to discover at least 1 route, axe-core to produce findings.

- [ ] **Step 7: Commit** — `feat(audit): wire route crawler into discoverRoutes + spawn per-surface dev servers [T147]`

---

## Task 4 — First A.4 audit run + INDEX

- [ ] **Step 1: Real run** across in-scope surfaces (webui, viewer, marketing) with runtime probes. May take 5-10 minutes.

- [ ] **Step 2: Append row** to `docs/audits/INDEX.md` with timestamp + counts + severity breakdown.

- [ ] **Step 3: Commit** — `feat(audit): first A.4 runtime audit with route crawler [T148]`

---

## Task 5 — T145-T148 tickets + worklogs

Single bundled commit per AGENTS.md format.

```
docs(audit): T145-T148 tickets + worklogs for A.4 route crawler
```

---

## Task 6 — Architect verification + PR

- Architect verification (Opus, separate context).
- Address caveats with cleanup commits.
- Open PR `feat/audit-a4-e2e-flows` → `main`.

---

## Out of scope for A.4 (deferred to A.5)

- 5 declarative E2E user flows (session create, attach file, mode switch, Experience screen, marketing CTA)
- Electron renderer probing (needs full Electron app spawn, not just renderer Vite)
- Ranker calibration based on accumulated A.1+A.2+A.4 findings
- Static React Router config AST parsing

## Self-review

- Plan addresses spec § 11.4 partial scope (route discovery only). E2E flows + ranker calibration moved to A.5.
- Plan resolves architect's "0 findings on real SPAs" concern by enabling live-server crawling.
- Risks: (a) dev server boot is 10-30s per surface; full audit run takes minutes; (b) Vite ports may conflict — surfaces use different default ports (5173, 5174, 5175) per their existing config; (c) renderer surface deferred (Electron complexity).
