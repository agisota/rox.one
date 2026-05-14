# T467 - R.11 fork review decision manifest

Status: DONE

## Context

R.11 remains blocked by `fork-review`: GitHub reports one visible fork while
the default expected fork count is zero.

## Goal

Create a report-only operator decision manifest for the visible fork inventory,
expected-count policy, and safe verification commands without contacting fork
owners or changing gate expectations.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- Extend the R.11 completion-audit regression so it requires the fork decision
  manifest, exact fork count, fork identity, no-contact/no-policy-change
  language, and dry-run verification commands.

## Required Subagents

None required unless fork evidence becomes ambiguous.

## TDD Requirements

- Add the failing audit regression before authoring the manifest.
- Confirm RED because the manifest does not exist yet.

## Implementation Requirements

- Add only report-only docs/tests/worklog changes.
- Do not contact fork owners.
- Do not change `ROX_R11_EXPECTED_FORKS`.
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

- [x] RED assertion fails because the fork decision manifest is absent.
- [x] Manifest records current fork count 1 and expected fork count 0.
- [x] Manifest records `dofaromg/rox-one-terminal` with owner, branch, and
  pushed timestamp.
- [x] Manifest preserves explicit no-contact/no-policy-change language.
- [x] Manifest points operators at dry-run verification commands before any
  expected-count override.
- [x] Targeted tests and validators pass.
- [x] No destructive R.11 action is performed.
