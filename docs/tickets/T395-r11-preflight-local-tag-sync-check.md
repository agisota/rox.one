# T395 - R.11 preflight local tag sync check

Status: DONE

## Context

R.11 eventually force-pushes `refs/tags/rebrand-v1` after the history rewrite.
Fresh read-only evidence shows the local `rebrand-v1` tag peels to
`906896e145156d92cf98457c4dc1893c53323bac`, while origin's
`refs/tags/rebrand-v1^{}` peels to
`b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`.

Both targets are currently outside `origin/main` ancestry. The existing
`rebrand-tag-on-main` gate catches the ancestry blocker, but the helper should
also fail closed when the local tag target differs from origin. Otherwise a
future R.11 operator could rewrite and force-push a stale local tag.

## Goal

Add a report-only R.11 preflight row that verifies the local `rebrand-v1` tag
and origin's `rebrand-v1` tag peel to the same commit before any backup,
rewrite, or forced tag push can proceed.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend `bun run rebrand:r11-preflight` only. It must remain report-only and
must not fetch, create, re-point, or push tags.

## Required Subagents

The explorer subagent pattern was attempted, but the native agent thread limit
was already reached. Proceed with local inspection only.

## TDD Requirements

Write the failing unit test first:

- `evaluateR11Preflight` fails closed when local and remote `rebrand-v1` tags
  do not match.
- The "reports every blocker" regression includes the new row.

Confirm the targeted test fails for the missing row before implementation.

## Implementation Requirements

- Add a distinct `rebrand-tag-local-sync` preflight row.
- Collect local-vs-remote tag-target parity without mutating refs.
- Keep `rebrand-tag-on-main` as a separate ancestry gate.
- Do not re-point `rebrand-v1`.
- Do not create backup refs, mirrors, rewritten history, or force-pushed refs.
- Do not call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`
- `git diff --check`

## Acceptance Criteria

- [x] Regression test fails before implementation.
- [x] Regression test passes after implementation.
- [x] Preflight has a distinct `rebrand-tag-local-sync` row.
- [x] Live preflight reports the local/remote tag mismatch.
- [x] T298 blocker surface records the mismatch.
- [x] Documentation/rebrand validation remains green.
- [x] Destructive R.11 actions are not executed.
- [x] Commit created.

## Worklog

See `docs/worklog/T395-r11-preflight-local-tag-sync-check.md`.
