# T157 - audit-smoke: run build before static-bundle gate

Status: done

## Context

Sub-project D architect review. `scripts/audit-smoke.sh` ran
`static-bundle` against existing `apps/*/dist/` directories. On a fresh
CI checkout those directories don't exist → probe finds no files →
0 findings → vacuous pass. Root cause: smoke never triggered a build.

## Goal

Modify `scripts/audit-smoke.sh` to run `webui:build` (Vite, ~20s)
before running the `static-bundle` probe against webui, so CI always
gates against a freshly built artefact.

Add `--skip-build` flag for fast local iteration (skips the Vite build,
uses existing dist/).

## Required UI

None.

## Required Data/API

None.

## Required Automations

- `validate:audit` = `bash scripts/audit-smoke.sh` (already wired in
  root `package.json`). No changes needed there.

## TDD Requirements

Manual verification:
1. `bash scripts/audit-smoke.sh` → builds webui then gates → exit 0.
2. `bash scripts/audit-smoke.sh --skip-build` → skips build → exit 0.

## Implementation Requirements

- Parse `--skip-build` from `$@` before the probe loop.
- Before each surface probe: if `SKIP_BUILD=0`, run
  `(cd "$REPO_ROOT" && "$BUN" run "$surface:build") 2>&1 | tail -3`.
- Output dir renamed from `static-bundle` → `static-bundle-$surface`
  in preparation for multi-surface loop (T158).

## Validation Commands

```bash
bash scripts/audit-smoke.sh              # expect exit 0, builds webui
bash scripts/audit-smoke.sh --skip-build # expect exit 0, skips build
```

## Acceptance Criteria

- [x] `webui:build` runs before static-bundle probe (no --skip-build)
- [x] `--skip-build` skips the build step
- [x] Script exits 0 with clean build + clean budget
- [x] Script exits 1 when probe emits findings
- [x] Worklog complete
- [x] Commit created

## Worklog

`docs/worklog/T156-T158-d-followup-architect-fixes.md`
