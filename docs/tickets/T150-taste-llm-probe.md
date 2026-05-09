# T150 - taste-llm probe with screenshot + Sonnet analysis

Status: complete

## Context

Phase A.3 of the audit harness. Add the `taste-llm` probe family that screenshots each crawled route and asks Claude Sonnet to identify visual / taste defects deterministic probes miss (alignment, contrast beyond axe minimums, hierarchy, typography, spacing, consistency). Reuses A.4's route crawler and Playwright runner; new dependency is the `LLMClient` from T149.

## Summary

Implement `packages/audit/src/probes/taste-llm.ts` as a `Probe` with `phase: "A.3"` and `applicableTo: () => true`. The probe short-circuits to `[]` when either `ctx.playwright` or `ctx.llm` is missing, then `discoverRoutes()` enumerates targets (live SPA crawl when `devServerUrl` is set, otherwise file-based fallback). For each route the probe takes a full-page PNG, calls `ctx.llm.analyzeScreenshot`, normalises severity, and emits a `Finding` with `confidence: 0.6`, `vdiImpact: { quality: 0.8, risk: 0.2, readiness: 0.4 }`, and `location.route` populated. Page-level errors are swallowed (per-route resilience). Wire the probe into `cli.ts` alongside the other modules; instantiate the LLM runner only when an A.3 probe is selected, and wrap construction in `try/catch` so a missing `ANTHROPIC_API_KEY` logs a warning and skips the LLM probes instead of crashing the run. Close the LLM runner in the same `finally` block as Playwright + dev servers.

## Acceptance Criteria

- [x] `ProbeContext` extended with optional `llm?: LLMClient` field (`packages/audit/src/probe.ts`).
- [x] `packages/audit/src/probes/taste-llm.ts` exports `tasteLlmProbe` with `name: "taste-llm"`, `phase: "A.3"`, `applicableTo: () => true`.
- [x] Probe returns `[]` when `ctx.playwright` is undefined.
- [x] Probe returns `[]` when `ctx.llm` is undefined.
- [x] Probe returns `[]` when `discoverRoutes` finds zero routes.
- [x] Probe takes full-page PNG via `page.screenshot({ fullPage: true, type: "png" })`.
- [x] Probe emits findings with `confidence: 0.6` and `phase: "A.3"`.
- [x] Findings populate `location.route`.
- [x] Per-route navigation/screenshot errors are caught and skipped (probe does not abort whole run).
- [x] `cli.ts` imports `tasteLlmProbe` and `createLLMRunner`; appends `tasteLlmProbe` to `probeModules`.
- [x] `cli.ts` instantiates `LLMRunner` only when an A.3 probe is selected; logs warning + falls back to `undefined` if `ANTHROPIC_API_KEY` is unset.
- [x] `contextFor` callback passes `llm` through to probes.
- [x] LLM runner closed in CLI `finally` block (alongside Playwright + dev servers).
- [x] `packages/audit/tests/probes/taste-llm.test.ts` — 3 tests pass (metadata, no-llm short-circuit, no-playwright short-circuit, empty-routes short-circuit). 4th case from plan simplified per stop-condition (file-based discovery returning [] verifies the integrated route-discovery path).
- [x] All audit tests pass: 77 / 77.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T150-taste-llm-probe.md` complete.
- [x] Commit created.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/probe.ts` | Modify (add `llm` field) |
| `packages/audit/src/probes/taste-llm.ts` | Create |
| `packages/audit/src/cli.ts` | Modify (wire probe, runner lifecycle) |
| `packages/audit/tests/probes/taste-llm.test.ts` | Create |

## Validation Commands

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## Worklog

`docs/worklog/T150-taste-llm-probe.md`
