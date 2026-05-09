# T153 - budget.json files for 4 user-facing surfaces

Status: done

## Context

Sub-project D of the audit harness. After the harness (A) ships, D codifies user engineering rules as automated CI gates. This ticket provisions `budget.json` files per surface so the `static-bundle` probe can detect bundle-size regressions.

Driving rule from `CLAUDE.md` § code_quality: `≤200KB JS bundle` (main entry chunk). Current surfaces exceed 200KB because they are large SPAs — the initial budgets are calibrated to current dist sizes + 10% headroom so the gate prevents regressions without demanding immediate refactoring.

## Goal

Create `apps/{webui,marketing,viewer,electron}/budget.json` calibrated against current build output. The `static-bundle` probe in `packages/audit/src/probes/static-bundle.ts` reads `budget.json` from `surfaceRoot`, checks each key filename in `dist/`, and emits a `bundle:over-budget` finding when the file exceeds its budget.

Initial run after adding `budget.json` must produce `findingCount: 0` (budgets set to current size + 10%).

## Required UI

None — CI / audit tooling only.

## Required Data/API

- Build each surface, measure largest JS chunk bytes.
- Set budget = measured bytes × 1.10 (ceil to integer).

## Required Automations

`static-bundle` probe automatically reads `budget.json` via `findBudget()` in `packages/audit/src/discovery.ts`. No changes to probe logic needed.

## Required Subagents

None — single-file writes per surface after measuring dist output.

## TDD Requirements

Manual verification: run `bun run packages/audit/src/cli.ts run webui --probes=static-bundle --no-tickets --out=/tmp/d-bundle` and assert `findingCount: 0`.

## Implementation Requirements

1. Build each surface (`webui:build`, `marketing:build`, `viewer:build`).
2. Measure largest JS file bytes in each `dist/assets/` directory.
3. Write `budget.json` with key = `assets/<filename>` and value = bytes × 1.10.
4. For electron: skip build (complex Electron packaging); write placeholder `{"main.js": 500000}`.
5. Verify probe returns 0 findings.

## Validation Commands

```bash
bun run webui:build
bun run marketing:build
bun run viewer:build
bun run packages/audit/src/cli.ts run webui --probes=static-bundle --no-tickets --out=/tmp/d-bundle
python3 -c "import json; d=json.load(open('/tmp/d-bundle/queue.json')); print(d['findingCount'])"
```

## Acceptance Criteria

- [x] `apps/webui/budget.json` exists, calibrated to current build
- [x] `apps/marketing/budget.json` exists, calibrated to current build
- [x] `apps/viewer/budget.json` exists, calibrated to current build
- [x] `apps/electron/budget.json` exists (placeholder, documented)
- [x] `bun run packages/audit/src/cli.ts run webui --probes=static-bundle --no-tickets` → `findingCount: 0`
- [x] Worklog complete
- [x] Commit created

## Worklog

`docs/worklog/T153-budget-json-per-surface.md`
