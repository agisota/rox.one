# T452 - R.11 backup artifact inventory target guards

Status: DONE

## Context

T446/T448 added latent target guard rows for R.11 backup artifacts, and T449
recorded them in the completion audit. The dedicated backup artifact inventory
still records only missing artifact presence rows, so it does not tell future
operators that artifact presence is not sufficient before `git filter-repo`.

## Goal

Refresh `docs/release/r11-backup-artifact-inventory-2026-05-14.md` so it
records `backup-tag-target`, `backup-branch-target`, and
`offline-mirror-target` as latent rows that evaluate only after the
corresponding artifacts exist.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-completion-audit.test.ts` so the
  backup artifact inventory must mention all three target guard IDs.

## Required Subagents

None. This is a narrow report-only inventory refresh.

## TDD Requirements

- Add the failing inventory regression before editing the inventory.
- Confirm RED because the target guard IDs are absent from the backup artifact
  inventory.

## Implementation Requirements

- Update only the backup artifact inventory, its regression test, and this
  ticket/worklog pair.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the backup artifact inventory lacks target
      guard IDs.
- [x] Inventory names `backup-tag-target`.
- [x] Inventory names `backup-branch-target`.
- [x] Inventory names `offline-mirror-target`.
- [x] Inventory explains target rows are latent until matching artifacts exist.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
