# T099 - Electron Smoke Shutdown Stabilization

Status: DONE

## Context

T096 and T097 recorded passing Electron smoke evidence on a GUI-capable launch
surface. T098 observed one later run where the same smoke path reached readiness
markers but did not exit before the harness timeout. Fresh T099 verification did
not reproduce the runtime timeout, but it did expose a source-level hardening gap
in the new smoke shutdown fallback: the force-exit timer was unref'ed and could
therefore be lost in edge cases.

## Goal

Keep `bun run electron:smoke` deterministic: the app must reach the existing
startup markers and then exit cleanly through smoke-mode shutdown, with a
retained force-exit fallback if normal async quit cleanup stalls.

## Required UI

No UI change.

## Required Data/API

- Preserve isolated `ROX_SMOKE_USER_DATA_DIR` and `ROX_CONFIG_DIR` behavior.
- Preserve the required smoke markers:
  - `ROX_SERVER_URL=`
  - `App initialized successfully`
- Ensure smoke-mode exit is not blocked by normal interactive quit cleanup.

## Required Automations

- Keep `electron:smoke` as the desktop startup gate.
- Add a focused regression test that protects the smoke shutdown bypass.
- Keep packaged smoke semantics unchanged unless validation shows the same
  shutdown path requires the same source-level fix.

## Required Subagents

No subagent required. The failing surface is already narrowed to the smoke
script and Electron main-process shutdown path.

## TDD Requirements

Before implementation:

1. Re-run `bun run electron:smoke` and record whether the readiness-marker
   timeout still reproduces.
2. Add a focused source-level regression test for smoke shutdown bypassing the
   async `before-quit` path.
3. Run the focused test and confirm the expected failure.

## Implementation Requirements

- Keep the fix minimal and scoped to smoke-mode shutdown if possible.
- Do not stage `events.jsonl`, `.claude/`, `.ouroboros/`, or unrelated dirty
  files into this ticket commit.
- Do not weaken marker assertions in `scripts/electron-smoke.ts`.

## Validation Commands

- `bun test scripts/__tests__/electron-smoke.test.ts`
- `bun run electron:smoke`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| `bun run electron:smoke` reaches markers and exits without timeout | DONE |
| Focused smoke regression test fails before the fix and passes after | DONE |
| Smoke marker assertions remain in place | DONE |
| Electron typecheck/lint pass or blockers are documented | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | DONE |

## Worklog

Update `docs/worklog/T099-electron-smoke-shutdown-stabilization.md`.
