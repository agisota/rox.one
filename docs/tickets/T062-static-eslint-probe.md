# T062 - static-eslint probe

Status: complete

## Context

Phase A.1. Fourth ticket. Implement the `static-eslint` probe: locate an ESLint config in the surface root, invoke `eslint --format=json`, parse the JSON output, and emit `Finding[]`. Must handle both ESLint v9 flat config (`eslint.config.js`) and legacy `.eslintrc.*` without crashing on either. Includes hermetic `eslint-broken/` fixture with two known violations.

## Summary

Create `packages/audit/src/probes/static-eslint.ts`. The probe checks for `eslint.config.js`, `.eslintrc.json`, and other config filenames in priority order. For legacy configs it appends `--no-eslintrc --config <path>`; for v9 flat configs no extra flags are needed. ESLint exits non-zero on violations — the probe treats any exit code as acceptable as long as stdout starts with `[`. Severity: ESLint severity 2 (error) → `high`, severity 1 (warning) → `medium`.

## Acceptance Criteria

- [x] Probe skips gracefully when no ESLint config found in `surfaceRoot`.
- [x] Probe parses 2 findings from `eslint-broken/` fixture (`no-unused-vars`, `no-console`).
- [x] Finding IDs are stable across re-runs.
- [x] ESLint error (severity 2) → Finding severity `high`; warning (severity 1) → `medium`.
- [x] Probe handles flat config (`eslint.config.js`) without `--no-eslintrc` flag.
- [x] `bun test packages/audit/tests/probes/static-eslint.test.ts` passes.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T062-static-eslint-probe.md` complete.
- [x] Commit created.

## TDD Test Shape

File: `tests/probes/static-eslint.test.ts` (2 test cases).

```
test("skips surface with no eslint config")
test("returns 2 findings for eslint-broken fixture")
```

Fixture: `tests/fixtures/eslint-broken/` — `package.json`, `eslint.config.js` (v9 flat), `src/violations.ts` with `no-unused-vars` and `no-console` violations.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/probes/static-eslint.ts` | Create |
| `packages/audit/tests/probes/static-eslint.test.ts` | Create |
| `packages/audit/tests/fixtures/eslint-broken/package.json` | Create |
| `packages/audit/tests/fixtures/eslint-broken/eslint.config.js` | Create |
| `packages/audit/tests/fixtures/eslint-broken/src/violations.ts` | Create |

## Validation Commands

```bash
cd packages/audit && bun test tests/probes/static-eslint.test.ts
cd packages/audit && bun run typecheck
```

## Worklog

`docs/worklog/T062-static-eslint-probe.md`
