# T144 - A.2 architect-followup cleanup

Status: complete

## Context

Architect verification of Phase A.2 (feat/audit-a2-runtime) identified 5 concerns that must be resolved before A.3 inherits them. These are focused correctness and robustness fixes — not new features.

## Summary

Five targeted fixes applied as individual commits on `feat/audit-a2-runtime`:

1. **Playwright lifecycle leak** — CLI had no `try/finally` around the registry-run + reporter block; a throw would leak the browser process. Wrapped in `try { … } finally { if (playwright) await playwright.close(); }`.
2. **runtime-states confidence** — Stylesheet substring matching is a known source of false positives. Architect recommended tightening the heuristic or downgrading confidence. Lighter option taken: confidence 0.7 → 0.5 across all three Finding emissions. Worklog T141 §10 updated.
3. **runtime-axe location.route** — `FindingLocation.route` was defined in `probe.ts` but never populated by the axe probe. Converted `targets` from plain URL strings to `{url, route}` objects; all Finding emissions now include `route` for downstream filtering.
4. **Strengthened tests** — Added CLI round-trip test (static-tsc, writes queue.json, asserts schemaVersion + findings array). Strengthened manifest-order test with `statSync` mtime assertion; skipped when mtimes are equal (sub-ms filesystem tolerance).
5. **CI-portable smoke script** — `validate:audit` previously hardcoded `bun` on PATH. Added `scripts/audit-smoke.sh` that resolves bun via PATH first, then `~/.bun/bin/bun` fallback. Updated `audit:smoke` and `validate:audit` in package.json.

## Acceptance Criteria

- [x] `packages/audit/src/cli.ts`: Playwright closed in `finally` block regardless of error path.
- [x] `packages/audit/src/probes/runtime-states.ts`: All three Finding emissions have `confidence: 0.5`.
- [x] `packages/audit/src/probes/runtime-axe.ts`: All Finding emissions include `location.route`.
- [x] `packages/audit/tests/cli.test.ts`: Round-trip smoke test (exits 0, queue.json valid).
- [x] `packages/audit/tests/reporters/json-queue.test.ts`: Manifest-order test uses mtime assertion.
- [x] `scripts/audit-smoke.sh`: Executable, resolves bun portably.
- [x] `package.json`: `audit:smoke` and `validate:audit` use `bash scripts/audit-smoke.sh`.
- [x] `bun test` passes with 67 tests, 0 failures.
- [x] `bun run typecheck` exits 0.
- [x] `bash scripts/audit-smoke.sh` exits 0.
