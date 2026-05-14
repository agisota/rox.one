# T427 - R.11 tag drift inventory

Status: DONE

## Context

The R.11 preflight is blocked by `rebrand-tag-local-sync` and
`rebrand-tag-on-main`, but the completion audit currently preserves only the
two peeled commit IDs inline.

## Goal

Create a read-only tag drift inventory for the R.11 tag blockers.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the existing R.11 completion-audit regression assertion so the audit
points to the durable tag drift inventory.

## Required Subagents

None. This is a narrow report-only audit artifact.

## TDD Requirements

Add the failing completion-audit assertion first and confirm it fails because
the tag drift inventory does not exist yet.

## Implementation Requirements

- Add `docs/release/r11-tag-drift-inventory-2026-05-14.md`.
- Record the local tag object and peeled commit.
- Record the origin tag object and peeled commit.
- Record that the origin peeled commit is not on `origin/main` ancestry.
- Record the remote branch that currently contains the origin peeled commit.
- Do not mutate, sync, delete, repoint, or force-push any tag.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit assertion proves the tag drift inventory is absent.
- [x] Tag drift report records local and origin tag objects plus peeled commits.
- [x] Tag drift report records origin ancestry failure and containing remote
  branch evidence.
- [x] Targeted, preflight, and documentation validation commands produce the
  expected results.

## Worklog

Update `docs/worklog/T427-r11-tag-drift-inventory.md`.
