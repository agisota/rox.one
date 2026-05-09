# T158 - extend audit-smoke to viewer + marketing static-bundle gates

Status: done

## Context

Sub-project D architect review. The smoke script only gated webui's
bundle budget despite viewer and marketing both having `budget.json`
files. Viewer and marketing were completely unguarded.

## Goal

Extend `scripts/audit-smoke.sh` to build and gate `viewer` and
`marketing` in addition to `webui`. All three surfaces are iterated via
a `SURFACES` array. Smoke fails (exit 1) if ANY surface produces
findings. Finding counts are aggregated across all surfaces before
emitting the final pass/fail message.

Electron is excluded: its budget (`main.js: 500000`) is a placeholder
and there is no `electron:build` that produces a single `main.js` chunk
in the expected location.

## Required UI

None.

## Required Data/API

None — both `apps/viewer/budget.json` and `apps/marketing/budget.json`
already exist (T153). Both have been updated to glob patterns (T156).

## Required Automations

- `validate:audit` = `bash scripts/audit-smoke.sh` (already wired).

## TDD Requirements

Manual verification:
1. `bash scripts/audit-smoke.sh` builds all 3 surfaces, all clean → exit 0.
2. Corrupt viewer or marketing budget → exit 1.

## Implementation Requirements

```bash
SURFACES=("webui" "viewer" "marketing")
for surface in "${SURFACES[@]}"; do
  # optional build step
  # probe step
done
# aggregate loop: sum findingCount across all static-bundle-* dirs
```

## Validation Commands

```bash
bash scripts/audit-smoke.sh       # exit 0, 3 builds + 3 probes
bash scripts/audit-smoke.sh --skip-build  # exit 0 against existing dist
```

## Acceptance Criteria

- [x] viewer and marketing probed in addition to webui
- [x] viewer:build and marketing:build run before respective probes
- [x] finding counts aggregated; single FAIL message with total
- [x] exit 0 with clean budgets
- [x] exit 1 with corrupt/stale budget on any surface
- [x] electron excluded with comment explaining why
- [x] Worklog complete
- [x] Commit created

## Worklog

`docs/worklog/T156-T158-d-followup-architect-fixes.md`
