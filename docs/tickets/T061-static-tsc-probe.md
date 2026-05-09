# T061 - static-tsc probe

Status: complete

## Context

Phase A.1. Third ticket after T060 infrastructure is in place. Implement the `static-tsc` probe: wrap `tsc --noEmit -p <surfaceRoot>/tsconfig.json`, parse the default diagnostic output format, and emit `Finding[]` with stable IDs. Includes hermetic `tsc-broken/` fixture with three known TS errors (TS2345, TS2322, TS7006).

## Summary

Create `packages/audit/src/probes/static-tsc.ts` and its fixture + test. The probe skips surfaces with no `tsconfig.json`. It invokes `bun x tsc --noEmit` (resolves to the project's pinned TypeScript 5.9.3 via Bun). It parses the `path(line,col): error TSxxxx: message` format. Severity mapping: TS6133/TS6196 → low, TS7006 → medium, all others → high.

## Acceptance Criteria

- [x] Probe skips gracefully when `tsconfig.json` absent from `surfaceRoot`.
- [x] Probe parses TS2345, TS2322, TS7006 from fixture and returns 3 findings.
- [x] Finding IDs are stable across re-runs for the same error location.
- [x] Finding severity: TS7006 → medium, TS2345/TS2322 → high.
- [x] `confidence = 1` for all tsc findings.
- [x] `bun test packages/audit/tests/probes/static-tsc.test.ts` passes.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T061-static-tsc-probe.md` complete.
- [x] Commit created.

## TDD Test Shape

File: `tests/probes/static-tsc.test.ts` (4 test cases).

```
test("skips surface with no tsconfig.json")
test("returns 3 findings for tsc-broken fixture")
test("finding IDs are stable across calls")
test("severity mapping: TS7006 → medium, TS2345 → high")
```

Fixture: `tests/fixtures/tsc-broken/` — `package.json`, `tsconfig.json`, `src/broken.ts` with 3 deliberate type errors.

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/probes/static-tsc.ts` | Create |
| `packages/audit/tests/probes/static-tsc.test.ts` | Create |
| `packages/audit/tests/fixtures/tsc-broken/package.json` | Create |
| `packages/audit/tests/fixtures/tsc-broken/tsconfig.json` | Create |
| `packages/audit/tests/fixtures/tsc-broken/src/broken.ts` | Create |

## Validation Commands

```bash
cd packages/audit && bun test tests/probes/static-tsc.test.ts
cd packages/audit && bun run typecheck
```

## Worklog

`docs/worklog/T061-static-tsc-probe.md`
