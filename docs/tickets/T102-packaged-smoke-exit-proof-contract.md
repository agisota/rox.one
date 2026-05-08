# T102 - Packaged Smoke Exit Proof Contract

Status: DONE

## Context

Packaged macOS smoke runs can lose readiness details from stdout/stderr because
production Electron logging may route through electron-log files. The current
dirty script correctly moves toward clean process exit as the packaged readiness
proof, but it still keeps a stale `CRAFT_SERVER_URL=` marker in the `seen`
initialization.

## Goal

Make the packaged smoke contract explicit: packaged smoke requires a clean
smoke-mode exit, treats stdout markers as optional diagnostics, and has no
stale required-marker state.

## Required UI

No UI change.

## Required Data/API

- `scripts/electron-smoke-packaged-mac.ts` should use an empty
  `REQUIRED_MARKERS` list.
- The `seen` marker map should be empty when there are no required markers.
- The script should still redact `CRAFT_SERVER_URL` and `CRAFT_SERVER_TOKEN`
  when those diagnostics appear.

## Required Automations

- Add a source-level regression test for the packaged smoke marker contract.
- Run packaged smoke if the local macOS packaged app exists.

## Required Subagents

No subagent required: this is one script and one test.

## TDD Requirements

Before implementation:

1. Add a focused test that fails on stale required-marker state.
2. Run it and confirm the expected failure.

## Implementation Requirements

- Do not change normal `scripts/electron-smoke.ts` marker requirements.
- Keep the packaged script focused on clean exit proof.
- Do not stage `events.jsonl`, `.claude/`, or `.ouroboros/`.

## Validation Commands

- `bun test scripts/__tests__/electron-packaged-smoke-contract.test.ts`
- `bun run electron:smoke:packaged:mac` when the packaged app exists
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Packaged smoke required markers are explicitly empty | DONE |
| Packaged smoke `seen` state has no stale marker entry | DONE |
| URL/token redaction remains in place | DONE |
| Normal Electron smoke marker requirements remain unchanged | DONE |
| Focused packaged-smoke contract test fails before the fix and passes after | DONE |
| Packaged smoke runtime check passes or blocker is documented | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | DONE |

## Worklog

Update `docs/worklog/T102-packaged-smoke-exit-proof-contract.md`.
