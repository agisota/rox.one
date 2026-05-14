# T465 - R.11 remote branch retirement manifest

Status: DONE

## Context

T464 cleared the live PR queue but R.11 remains blocked by
`remote-branch-review`: origin still exposes 150 non-main/non-R.11-backup
branch heads.

## Goal

Create a report-only, operator-ready manifest that turns the 150-branch blocker
into exact review buckets, preservation rules, and dry-run command guidance
without deleting, pruning, merging, or force-updating any remote branch.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- Extend the R.11 completion-audit regression so it requires the branch
  retirement manifest, bucket counts, preservation rules, and no-destructive
  authorization language.

## Required Subagents

Use read-only subagents only if more branch/PR inventory verification is
needed. No subagent may delete or mutate refs.

## TDD Requirements

- Add the failing audit regression before authoring the manifest.
- Confirm RED because the manifest does not exist yet.

## Implementation Requirements

- Add only report-only docs/tests/worklog changes.
- Do not delete, prune, merge, or rename any local or remote branch.
- Do not mutate tags, create backup refs, create an offline mirror, run
  `git filter-repo`, force-push, clear `/goal`, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the remote branch retirement manifest is
  absent.
- [x] Manifest records 150 non-main/non-R.11-backup branches.
- [x] Manifest records 0 open PR branches, 133 merged PR heads, 9
  closed/unmerged PR heads, 7 no-visible-PR heads, and 1 backup/protected
  branch.
- [x] Manifest preserves explicit no-destructive-authorization language.
- [x] Manifest points operators at dry-run review commands before any remote ref
  deletion command.
- [x] Targeted tests and validators pass.
- [x] No destructive R.11 action is performed.
