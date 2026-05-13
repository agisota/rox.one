# T341 - Post-PR112 validation contract refresh

Status: DONE

## Context

After rebasing the post-merge validation branch onto current `origin/main`,
the cheap documentation gates exposed two current-main
contract drifts:

- `bun run validate:docs` rejected `T223-tenant-credential-key-derivation.md`
  because it had a markdown `## Status` section but no machine-readable
  `Status:` line.
- `bun run validate:roadmap` rejected the spine ledger row `M.1.3b` because the
  master roadmap had no matching `# Phase` heading for the landed Pi IPC split.

## Goal

Restore the documentation validation contracts without changing runtime source
or widening the existing validation repair branch.

## Required UI

None.

## Required Data/API

No runtime data, API, or storage behavior changes.

## Required Automations

The existing `validate:docs` and `validate:roadmap` gates must return to green.

## Required Subagents

None. The failing validator output identifies the exact documentation files.

## TDD Requirements

Use the existing gates as the red checks:

- `bun run validate:docs`
- `bun run validate:roadmap`

## Implementation Requirements

- Add a machine-readable status line to the stale T223 tenant-credential
  planning ticket without marking it complete.
- Align the master-roadmap headings with the landed spine ledger split:
  `M.1.3` for server-core RPC handler migration and `M.1.3b` for Pi IPC scope
  propagation.
- Do not change runtime files.

## Validation Commands

- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

## Acceptance Criteria

- [x] `T223-tenant-credential-key-derivation.md` has a `Status:` line.
- [x] The master roadmap has a heading for `M.1.3b`.
- [x] Documentation validators pass.
- [x] Runtime source is unchanged by this ticket.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T341-post-pr112-validation-contract-refresh.md`.
