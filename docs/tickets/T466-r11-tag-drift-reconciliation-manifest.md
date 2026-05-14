# T466 - R.11 tag drift reconciliation manifest

Status: DONE

## Context

R.11 remains blocked by `rebrand-tag-local-sync` and `rebrand-tag-on-main`.
The existing tag inventory proves the drift but does not yet provide an
operator-ready reconciliation decision surface.

## Goal

Create a report-only manifest that records the exact local/origin `rebrand-v1`
tag targets, the ancestry failure, candidate operator decisions, and dry-run
verification commands without mutating any tag.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- Extend the R.11 completion-audit regression so it requires the tag drift
  reconciliation manifest, target SHAs, no-mutation language, and dry-run
  verification commands.

## Required Subagents

None required unless tag evidence becomes ambiguous.

## TDD Requirements

- Add the failing audit regression before authoring the manifest.
- Confirm RED because the manifest does not exist yet.

## Implementation Requirements

- Add only report-only docs/tests/worklog changes.
- Do not delete, retarget, force-update, push, or sync local or remote tags.
- Do not create backup refs, create an offline mirror, run `git filter-repo`,
  force-push, clear `/goal`, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the tag reconciliation manifest is absent.
- [x] Manifest records the local tag object and peeled commit.
- [x] Manifest records the origin tag object and peeled commit.
- [x] Manifest records the `origin/main` ancestry failure and containing remote
  branch.
- [x] Manifest preserves explicit no-tag-mutation/no-destructive-authorization
  language.
- [x] Manifest points operators at dry-run verification commands before any tag
  mutation command shape.
- [x] Targeted tests and validators pass.
- [x] No destructive R.11 action is performed.
