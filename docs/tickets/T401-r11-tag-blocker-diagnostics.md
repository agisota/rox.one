# T401 - R.11 tag blocker diagnostics

Status: DONE

## Context

R.11 remains blocked before backup creation. The current blocker surface includes
`rebrand-tag-local-sync` and `rebrand-tag-on-main`, but the report-only preflight
only says the tag differs or is off-main. Operators need the exact local and
origin tag targets in the preflight detail before deciding any future unblock
path.

## Goal

Make the report-only R.11 preflight print concrete `rebrand-v1` target evidence
for the local-sync and tag-on-main checks.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Update only the report-only R.11 preflight tooling. Do not create, fetch,
re-point, or push tags. Do not create backup refs, mirrors, rewritten history,
or force-pushed refs.

## Required Subagents

None. The change is bounded to the existing preflight script and its tests.

## TDD Requirements

Add the failing regression test first. The test must prove failed tag-local-sync
and tag-on-main rows include the relevant local and origin `rebrand-v1` commit
evidence.

## Implementation Requirements

- Add optional snapshot fields for origin and local `rebrand-v1` peeled commit
  values.
- Include those values in `rebrand-tag-local-sync` pass/fail details.
- Include the origin value in `rebrand-tag-on-main` pass/fail details.
- Preserve report-only behavior: no ref mutation, no backup creation, no
  history rewrite.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## Acceptance Criteria

- [x] RED test fails before implementation for missing tag target detail.
- [x] Failed local-sync row includes both local and origin `rebrand-v1` targets
      when known.
- [x] Failed tag-on-main row includes the origin `rebrand-v1` target when known.
- [x] Preflight remains report-only.
- [x] Targeted tests and relevant validation pass.
- [x] Current R.11 blockers remain explicit.
- [x] Commit created.

## Worklog

See `docs/worklog/T401-r11-tag-blocker-diagnostics.md`.
