# T150 - taste-llm probe with screenshot + Sonnet analysis

## 1. Task summary

Ship the `taste-llm` probe: per route, take a full-page PNG via the existing Playwright runner, send it to Sonnet via the `LLMClient` from T149, and emit `Finding` objects for each taste defect Sonnet reports. Wire it into `cli.ts` so `--probes=taste-llm` (or any A.3+ glob) runs end-to-end. The CLI must tolerate a missing `ANTHROPIC_API_KEY` — log a warning, skip the probe, do not crash the run.

## 2. Repo context discovered

- `discoverRoutes(surface, surfaceRoot, devServerUrl, playwright)` in `src/discovery.ts` already implements the live-crawl-or-file-fallback split that runtime probes use. The new probe reuses it verbatim.
- `runtime-axe.ts` is the closest pattern for "iterate routes → goto → emit findings"; the new probe deliberately mirrors its lifecycle (per-route `try/finally` with `page.close()`) and target-URL construction.
- `ProbeContext` already has the optional `playwright` field. Adding `llm?: LLMClient` follows the same convention; the type import on `probe.ts` is type-only (`import type ...`) to avoid pulling SDK types into modules that never touch the runner.
- `cli.ts` already gates Playwright instantiation on `registry.list().some((p) => p.phase !== "A.1")`. The same pattern is repeated for the LLM runner gated on `phase === "A.3"`.

## 3. Files inspected

- `packages/audit/src/probe.ts` — `ProbeContext` shape and `Probe` interface.
- `packages/audit/src/probes/runtime-axe.ts` — per-route iteration pattern and target URL construction.
- `packages/audit/src/discovery.ts` — `discoverRoutes` semantics for live + file-based modes.
- `packages/audit/src/cli.ts` — runner instantiation + lifecycle in `try/finally`.
- `packages/audit/tests/probes/runtime-axe.test.ts` — test file structure.

## 4. Tests added first

| File | Tests |
|---|---|
| `packages/audit/tests/probes/taste-llm.test.ts` | 4 (metadata, no-llm, no-playwright, no-routes) |

Tests written before implementation per TDD.

The 4th test from the original plan asked to verify that with a fully mocked `playwright + llm` and a `devServerUrl`, the probe emits a finding from the mocked `analyzeScreenshot` response. Implementing that end-to-end requires also mocking `discoverRoutes` (which would need a separate stub or a private export). Per the plan's stop conditions ("If test mocking is awkward: simplify the 4th test to verify the run-with-mocked-routes path"), the test was reshaped to feed a `surfaceRoot` that has no `src/pages` directory. `discoverRoutes` returns `[]`, the probe's early-exit guard fires, and the test confirms the integration of route discovery with the probe's logic flow without exercising the LLM call. The mocked `LLMClient` and mocked `PlaywrightRunner` remain in the file so a future test can pick them up if we expose a `_runForRoutes` helper.

## 5. Expected failing test output

```
error: Cannot find module '../../src/probes/taste-llm.ts'
    at <anonymous> (packages/audit/tests/probes/taste-llm.test.ts:2:0)
```

## 6. Implementation changes

- `packages/audit/src/probe.ts`:
  - Added `import type { LLMClient } from "./runners/llm-runner.ts"` (type-only).
  - Added optional `llm?: LLMClient` to `ProbeContext`.
- `packages/audit/src/probes/taste-llm.ts` (created):
  - `severityFromString` normalises Sonnet's severity strings to `FindingSeverity`, defaulting to `"medium"` on unknown values.
  - `tasteLlmProbe` short-circuits to `[]` when `playwright` or `llm` is missing, then calls `discoverRoutes` and short-circuits again when zero routes are found.
  - For each route: navigate with `waitUntil: "networkidle"` and a 15s timeout, take a `fullPage: true` PNG, call `ctx.llm.analyzeScreenshot`, and append findings with `confidence: 0.6`, `vdiImpact: { quality: 0.8, risk: 0.2, readiness: 0.4 }`, `phase: "A.3"`, and `location.route` populated.
  - Per-route errors are caught and skipped — a single broken route does not abort the whole probe.
  - `page.close()` runs in a `finally` block so pages never leak.
- `packages/audit/src/cli.ts`:
  - Imported `tasteLlmProbe` and `createLLMRunner, type LLMClient`.
  - Appended `tasteLlmProbe` to `probeModules`.
  - Added a second runner-instantiation block: `needsLLM = registry.list().some((p) => p.phase === "A.3")`. Wrapped in `try/catch` so a missing `ANTHROPIC_API_KEY` writes a warning to stderr and leaves `llm` as `undefined` (the probe will short-circuit to `[]`).
  - `contextFor` now returns `llm` alongside `playwright` and `devServerUrl`.
  - `finally` block closes the LLM runner with `.catch(() => undefined)` (defensive — `close()` is a no-op today but the wrapping makes the lifecycle robust to future changes).

Commits (T150, 1 commit):
- `865c7a8` feat(audit): taste-llm probe with screenshot + Sonnet analysis [T150]

## 7. Validation commands run

```bash
cd packages/audit && ~/.bun/bin/bun test
cd packages/audit && ~/.bun/bin/bun run typecheck
```

## 8. Passing test output summary

```
bun test v1.3.13 (bf2e2cec)

 77 pass
 0 fail
 161 expect() calls
Ran 77 tests across 18 files. [7.51s]
```

`taste-llm.test.ts`: 4 pass (metadata, no-llm short-circuit, no-playwright short-circuit, no-routes short-circuit). `llm-runner.test.ts`: 2 pass (interface, DI). Combined audit suite: 77 / 77 (was 71 / 71 before A.3).

## 9. Build output summary

No build step. `tsc --noEmit` exits 0.

## 10. Remaining risks

- **Confidence 0.6 < deterministic probes (1.0)**: Sonnet's findings are ranked below tsc/eslint/axe-core. The default ranker downweights but does not filter. Real findings should be reviewed by a designer before being auto-promoted to tickets — recommend running with `--no-tickets` until A.3 has had at least one human-validated cycle.
- **Per-route timeouts**: the probe uses a 15s navigation timeout to keep the wall-clock cost bounded, but a flaky dev server could still inflate a single run. The per-route `try/catch` guarantees the whole probe completes even if some routes fail.
- **No screenshot caching**: each run re-screenshots and re-sends the full PNG. Sonnet's prompt cache is keyed on the system prompt, not the image, so identical screenshots across runs do not benefit from cache hits today. A future T can hash the PNG and skip the API call when the hash matches a previous run's result.
- **CLI lifecycle ordering**: the `finally` block now closes Playwright, then LLM, then dev servers. Order matters only weakly (LLM close is a no-op), but the explicit ordering keeps future maintenance straightforward.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| `ProbeContext` extended with `llm` | ✅ | `probe.ts` line 23 |
| `tasteLlmProbe` exported with correct metadata | ✅ | `probes/taste-llm.ts` lines 11–13 |
| Returns `[]` when no LLM | ✅ | `probes/taste-llm.ts` line 17; test "returns [] when no LLM client provided" |
| Returns `[]` when no playwright | ✅ | `probes/taste-llm.ts` line 16; test "returns [] when no playwright provided" |
| Returns `[]` when no routes | ✅ | `probes/taste-llm.ts` line 20; test "returns [] when discoverRoutes finds no routes" |
| Full-page PNG via screenshot | ✅ | `probes/taste-llm.ts` line 31 |
| `confidence: 0.6` on findings | ✅ | `probes/taste-llm.ts` line 53 |
| `location.route` populated | ✅ | `probes/taste-llm.ts` line 50 |
| Per-route errors swallowed | ✅ | `probes/taste-llm.ts` lines 60–62 |
| CLI wires probe + runner + lifecycle | ✅ | `cli.ts` import + `probeModules` + `needsLLM` block + `finally` |
| Missing `ANTHROPIC_API_KEY` warns + skips | ✅ | `cli.ts` `try/catch` around `createLLMRunner({})` |
| Tests pass: 77/77 | ✅ | Test run output above |
| typecheck exits 0 | ✅ | No output |
