# T402 - R.11 stale remote branch preflight

Status: DONE

## Context

R.11's global stop condition requires `git log -p --all` to show zero
forbidden-token matches outside the legal-preserve allowlist. That gate covers
remote-tracking refs too. The R.11 runbook also says that by the force-push
phase only `main` and the backup branch should remain relevant.

Current origin still has many non-main branches, including
`origin/chore/rebrand-R10-final-sweep-and-gate`, which contains the current
origin `rebrand-v1` tag target.

## Goal

Make the report-only R.11 preflight fail closed in the explicit pre-rewrite
stage when origin still has non-main, non-R.11-backup branches.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Use read-only git commands only. Do not delete, push, force-push, fetch-prune,
or rewrite refs.

## Required Subagents

None. The change is bounded to the existing preflight script and tests.

## TDD Requirements

Add the failing regression test first. The test must prove the explicit
pre-rewrite stage reports stale origin branches as blockers while the default
pre-backup stage remains focused on pre-backup gates.

## Implementation Requirements

- Add snapshot fields for stale remote branch names and remote-branch query
  errors.
- Add a pre-rewrite-only preflight row that passes when only `main` and
  `backup/pre-rebrand-history-rewrite-2026-05-13` remain on origin.
- Collect branch names with read-only `git ls-remote --heads origin`.
- Preserve report-only behavior: no remote branch deletion, no tag mutation, no
  backup creation, and no history rewrite.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight`
- `ROX_R11_NO_ACTIVE_GOAL=1 bun run rebrand:r11-preflight --stage pre-rewrite`

## Acceptance Criteria

- [x] RED test fails before implementation for missing stale remote branch row.
- [x] Default pre-backup preflight does not require remote branch cleanup.
- [x] Explicit pre-rewrite preflight fails when stale origin branches remain.
- [x] Explicit pre-rewrite row reports the stale branch names.
- [x] Preflight remains report-only.
- [x] Targeted tests and relevant validation pass.
- [x] Commit created.

## Worklog

See `docs/worklog/T402-r11-stale-remote-branch-preflight.md`.
