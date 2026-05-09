# T063 - static-bundle probe

Status: complete

## Context

Phase A.1. Fifth ticket. Implement the `static-bundle` probe: read `<surfaceRoot>/budget.json` (map of filename → maxBytes), stat corresponding files in `dist/` (or `ctx.buildOutputRoot`), and emit a `Finding` for each file exceeding its budget. Includes hermetic `bundle-bloated/` fixture with a pre-built dist file and a tight budget that triggers a finding.

## Summary

Create `packages/audit/src/probes/static-bundle.ts`. The probe reads `budget.json` from the surface root. If absent, it returns `[]` (graceful skip). For each entry in the budget, it stats the file in `distRoot` and emits a `bundle:over-budget` finding if `actualBytes > maxBytes`. Severity is always `high` (budget overruns directly impact load time and VDI readiness). Does not trigger a build — reads existing `dist/` artifacts only.

## Acceptance Criteria

- [x] Probe skips gracefully when `budget.json` absent from `surfaceRoot`.
- [x] Probe emits 1 finding for `bundle-bloated/` fixture where `dist/main.js` exceeds the budget entry.
- [x] Finding rule is `bundle:over-budget`.
- [x] Finding message includes actual bytes, budget bytes, and overage.
- [x] Finding severity is `high`.
- [x] `bun test packages/audit/tests/probes/static-bundle.test.ts` passes.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T063-static-bundle-probe.md` complete.
- [x] Commit created.

## TDD Test Shape

File: `tests/probes/static-bundle.test.ts` (3 test cases).

```
test("skips surface with no budget.json")
test("returns 0 findings when dist file within budget")
test("returns 1 finding when dist file exceeds budget")
```

Fixture: `tests/fixtures/bundle-bloated/` — `package.json`, `budget.json` (sets `main.js` max to 100 bytes), `dist/main.js` (pre-built, >100 bytes).

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/probes/static-bundle.ts` | Create |
| `packages/audit/tests/probes/static-bundle.test.ts` | Create |
| `packages/audit/tests/fixtures/bundle-bloated/package.json` | Create |
| `packages/audit/tests/fixtures/bundle-bloated/budget.json` | Create |
| `packages/audit/tests/fixtures/bundle-bloated/dist/main.js` | Create |

## Validation Commands

```bash
cd packages/audit && bun test tests/probes/static-bundle.test.ts
cd packages/audit && bun run typecheck
```

## Worklog

`docs/worklog/T063-static-bundle-probe.md`
