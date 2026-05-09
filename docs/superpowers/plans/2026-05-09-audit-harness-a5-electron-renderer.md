# Audit Harness — Phase A.5 Electron Renderer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Run audit probes against the Electron renderer (`apps/electron/src/renderer`). The dev-server-runner pattern from A.4 doesn't apply: the Electron renderer is not a Vite dev server but a `BrowserWindow` loading content from a packaged renderer build with a preload script and IPC to the main process. A.5 introduces an `electron-runner` that uses Playwright's `_electron.launch()` to drive the real Electron binary.

**Sequencing:** A.5 lands after A.4 (already done). This plan completes Slice 1 of the architecture roadmap (`.claude/plans/improve-codebase-architecture-plan-tune-tingly-barto.md`).

**Tech Stack:** Bun + Playwright `_electron` API (already in deps via `playwright` 1.49.1). No new prod deps.

**Tickets:** T152 (electron-runner), T153 (renderer surface integration), T154 (first A.5 audit run).

**Branch:** `feat/audit-a5-electron-renderer`.

---

## Architecture decision

**Why not the dev-server pattern.** The A.4 dev-server-runner spawns `bun run <surface>:dev`, waits for `Local: http://...` in stdout, and connects Playwright over HTTP. Electron renderer has none of those affordances:
- No HTTP server (renderer loads `file://` or packaged HTML).
- Preload script runs in an isolated context; main-process IPC is required for many code paths.
- `electron:dev` (`bun run electron:dev`) launches the full app, not a navigatable URL.

**Why `_electron.launch()`.** Playwright's `_electron` API (https://playwright.dev/docs/api/class-electron) launches an Electron binary directly, exposes its first `BrowserWindow` as a `Page`, and lets axe / runtime-states probes operate against that page exactly as they do for web surfaces. Cleanup is `electronApp.close()` in a `finally` block — same shape as `playwright.close()`.

**Route discovery is different.** Web SPAs are crawled by following anchor `href`s (the A.4 `route-crawler.ts`). Electron renderer uses a closed route table defined in `apps/electron/src/shared/route-parser.ts`. A.5 probes its routes via that registry, not by crawl. New helper: `discoverRendererRoutes()` reads the route table directly.

**Surface naming.** `Surface` adds `"electron-renderer"` (kebab-case, distinguishes from the existing `"renderer"` placeholder which `cli.ts` already maps to `apps/electron/src/renderer`). Migration: rename the existing `"renderer"` to `"electron-renderer"` everywhere — the existing surface was a placeholder reserved for A.5.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `packages/audit/src/runners/electron-runner.ts` | Wrap `_electron.launch()`; return `{ page, app, close() }` |
| `packages/audit/src/discovery-renderer.ts` | Read `apps/electron/src/shared/route-parser.ts` route table; return `RouteInfo[]` for the renderer surface |
| `packages/audit/tests/runners/electron-runner.test.ts` | Launch + close lifecycle; first-window page resolution |
| `packages/audit/tests/discovery-renderer.test.ts` | Route table parse + non-empty assertion |

### Modified

| Path | Change |
|---|---|
| `packages/audit/src/probe.ts` | `Phase` union adds `"A.5"`; `Surface` union adds `"electron-renderer"`; `ProbeContext` adds optional `electronApp?: ElectronAppHandle` |
| `packages/audit/src/probes/runtime-axe.ts` | When `surface === "electron-renderer"`, use `ctx.electronApp.page` instead of crawling `ctx.devServerUrl`; route enumeration via `discoverRendererRoutes()` |
| `packages/audit/src/probes/runtime-states.ts` | Same `electron-renderer` branch |
| `packages/audit/src/cli.ts` | When `electron-renderer` is in surfaces, spawn an `electronApp` instead of (or alongside) dev servers; pass via context; cleanup in `finally` |
| `packages/audit/src/cli.ts` | Probe registration: existing hand-written list updates to import any new probe; the registry-discovery test (`registry-discovery.test.ts`) enforces this |
| `docs/decision-records/audit-harness/0001-finding-model.md` | Move A.5 from "Out of scope" to "Phases" section |

### Renamed

| From | To | Reason |
|---|---|---|
| `Surface = "renderer" \| ...` | `Surface = "electron-renderer" \| ...` | Disambiguate from the placeholder |

---

## Task 1 — Electron runner (TDD)

- [ ] **Step 1: Failing test** at `packages/audit/tests/runners/electron-runner.test.ts`:
  - `launchElectron({ entry, args, timeoutMs })` rejects when entry path doesn't exist.
  - `launchElectron(...)` resolves with `{ app, page, close }` against the real Electron binary; `page.url()` matches the renderer's expected file URL.
  - `close()` invokes `app.close()` and resolves; subsequent `page.evaluate` rejects.
- [ ] **Step 2:** Implement `packages/audit/src/runners/electron-runner.ts` exporting `launchElectron(opts): Promise<ElectronAppHandle>` where `ElectronAppHandle = { app: ElectronApplication; page: Page; close(): Promise<void> }`.
- [ ] **Step 3:** Verify tests pass under `bun test packages/audit/tests/runners/electron-runner.test.ts`.

**Constraints:**
- Use `process.execPath` only as a fallback; primary entry is the Electron binary resolved via `require.resolve("electron")` from the workspace root.
- `timeoutMs` default 30_000.
- Do NOT spawn the full electron:dev pipeline (which builds + watches). Use a pre-built renderer at `apps/electron/dist/` or a fixture renderer; document the choice in the test file.

## Task 2 — Renderer route discovery (TDD)

- [ ] **Step 1: Failing test** at `packages/audit/tests/discovery-renderer.test.ts`: `discoverRendererRoutes()` returns ≥3 routes including `"/"`, picked from `apps/electron/src/shared/route-parser.ts`.
- [ ] **Step 2:** Implement `packages/audit/src/discovery-renderer.ts`. Two valid approaches — pick whichever the route-parser module supports:
  - (a) Static import + introspection: import the route table directly and enumerate.
  - (b) Source parsing: read the file and regex-extract route paths. Use only if (a) is impossible due to compile-time IPC dependencies.
- [ ] **Step 3:** Verify tests pass.

## Task 3 — Phase + surface union extension

- [ ] **Step 1:** Add `"A.5"` to `Phase` and `"electron-renderer"` to `Surface` in `packages/audit/src/probe.ts`.
- [ ] **Step 2:** Replace the existing placeholder `"renderer"` everywhere with `"electron-renderer"`. Files touched (grep first to confirm completeness):
  - `packages/audit/src/cli.ts` (surfaces map, validSurfaces array, devCommands map)
  - `packages/audit/src/ranker.config.ts` (surfaceWeight)
  - All probe files and their tests
  - `packages/audit/tests/registry.test.ts` (surface fixtures)
- [ ] **Step 3:** Add `electronApp?: ElectronAppHandle` to `ProbeContext`.
- [ ] **Step 4:** Run `bun run typecheck` for the audit package; expect 0 errors.

## Task 4 — Probe integration

- [ ] **Step 1: Failing test** for `runtime-axe.ts`: when `ctx.surface === "electron-renderer"` and `ctx.electronApp` is present, axe runs against `ctx.electronApp.page` and produces a finding with `phase: "A.5"`.
- [ ] **Step 2:** Implement the branch in `runtime-axe.ts`. Same shape for `runtime-states.ts`.
- [ ] **Step 3:** Verify under `bun test packages/audit/`.

## Task 5 — CLI wire-up

- [ ] **Step 1:** Modify `packages/audit/src/cli.ts`:
  - Add `electron-renderer` to `validSurfaces` and `surfacePaths`.
  - When `electron-renderer` is requested, call `launchElectron(...)` once and pass the handle into `contextFor` via `electronApp`.
  - In the `finally` block, `await electronApp.close()`.
- [ ] **Step 2:** Verify with smoke run: `bun run packages/audit/src/cli.ts run electron-renderer --probes=runtime-axe --no-tickets --out=audits/_a5-smoke`.
- [ ] **Step 3:** Update `scripts/audit-smoke.sh` if it asserts surface coverage.

## Task 6 — First A.5 audit run

- [ ] **Step 1:** Run: `bun run packages/audit/src/cli.ts run electron-renderer --probes=runtime-axe,runtime-states --no-tickets --out=audits/2026-05-09T_a5-first`.
- [ ] **Step 2:** Append a row to `docs/audits/INDEX.md` (same format as T148).
- [ ] **Step 3:** Capture findings in worklog `docs/worklog/T154-first-a5-audit-run.md`.

---

## Acceptance criteria

| Criterion | Evidence |
|---|---|
| `electron-runner` launches and cleans up cleanly | Test pass; no orphaned electron processes after smoke run |
| `Phase` union includes `"A.5"` | TypeScript compile passes; `0001-finding-model.md` updated |
| `Surface = "electron-renderer"` everywhere; no stray `"renderer"` | grep returns 0 hits for `"renderer"` (as a Surface literal) |
| `runtime-axe` and `runtime-states` produce A.5 findings | First A.5 run emits manifest with `surfaces: ["electron-renderer"]` and at least one finding |
| Existing A.1-A.4 audit runs unchanged | Re-run A.4 smoke; manifest delta = surface rename only |
| `bun test` green at root | All audit suite + repo tests pass |
| Registry-discovery test still green | New probes (none expected) auto-registered |

---

## Out of scope

- **Authenticated renderer routes.** Routes behind login require a fixture user / session. Track as A.6 if value emerges.
- **Main-process IPC contract auditing.** Probes audit renderer DOM, not main↔renderer message correctness. Separate concern.
- **Packaged-app audit (post-`electron:build`).** A.5 audits the dev renderer; packaged-app audits would catch packaging regressions and are a separate phase.
- **Probe parallelism across electron windows.** First window only. Multi-window auditing is future work.

---

## Risks

- **Electron version drift.** Playwright's `_electron` API is tied to Electron versions; CI must pin both. Already pinned via lockfile.
- **CI runner sandboxing.** Some CI environments need `--no-sandbox` for Electron; expose this as `launchElectron({ args: ["--no-sandbox"] })` and document in the smoke script.
- **Route table introspection failure** if `route-parser.ts` cross-compiles main-process imports. Fallback to source-parsing keeps A.5 unblocked.
