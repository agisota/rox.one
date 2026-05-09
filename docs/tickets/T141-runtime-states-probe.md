# T141 - Runtime-states probe + fixture

Status: complete

## Context

Phase A.2 of the audit harness. Add the `runtime-states` probe to assert interactive components render required state variants (hover, focus, disabled, loading, error, empty).

## Summary

Implement `packages/audit/src/probes/runtime-states.ts` as a heuristic probe (confidence 0.7) that checks three patterns: (1) interactive elements must have CSS rules for `:hover`, `:focus`, or `:disabled`, (2) lists must either have children or a sibling with class containing "empty"/"no-results", (3) forms must have error-state markup (e.g., `[aria-invalid]`, `[role=alert]`, or class "error"/"invalid"). Emit findings for missing variants. Create fixture with button missing disabled state, list with no empty markup, form with no error capability. Write tests validating heuristic detections.

## Acceptance Criteria

- [x] `packages/audit/src/probes/runtime-states.ts` exports `runtimeStatesProbe` with name, phase A.2.
- [x] Probe checks: interactive elements (button, a[href], input, select, textarea) for `:hover`/`:focus`/`:disabled` CSS.
- [x] Probe checks: lists (ul, ol, [role=list]) for children or empty-state sibling.
- [x] Probe checks: forms for error-state markup ([aria-invalid], [role=alert], error/invalid class).
- [x] Confidence = 0.7 (heuristic, not exhaustive).
- [x] Findings include message, suggestion, and rule name (e.g., `runtime-states:button-missing-disabled`).
- [x] Fixture `packages/audit/tests/fixtures/states-broken/index.html` with ≥3 missing states.
- [x] `packages/audit/tests/probes/runtime-states.test.ts` — 2 tests pass (metadata, detects missing states on fixture).
- [x] CLI wired: probe registered, playwright context injected when selected.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T141-runtime-states-probe.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/probes/runtime-states.test.ts`, `tests/fixtures/states-broken/`.

```
runtime-states.test.ts:
  - metadata (name, phase, applicableTo)
  - detects missing states on fixture (≥1 findings expected)
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/probes/runtime-states.ts` | Create |
| `packages/audit/tests/probes/runtime-states.test.ts` | Create |
| `packages/audit/tests/fixtures/states-broken/index.html` | Create |
| `packages/audit/tests/fixtures/states-broken/package.json` | Create |
| `packages/audit/src/cli.ts` | Modify — register probe |

## Validation Commands

```bash
cd packages/audit && bun test tests/probes/runtime-states.test.ts
bun run audit run marketing --probes=runtime-states
```

## Worklog

`docs/worklog/T141-runtime-states-probe.md`
