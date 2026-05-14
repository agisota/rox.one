# T431 - R.11 README banner audit coverage

Status: DONE

## Context

The R.11 goal requires a `README.md` section named "After R.11 history
rewrite" with a 72-hour visible banner after force-push. T298 tracks this as a
blocked closeout acceptance criterion, but the durable completion audit does
not yet map that explicit artifact.

## Goal

Update the durable R.11 completion audit so the README post-rewrite
coordination banner is listed as a blocked artifact until the destructive
rewrite and force-push complete.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Extend the R.11 completion-audit regression so it requires the README banner
artifact, section name, and blocked state.

## Required Subagents

None. This is a narrow report-only audit coverage change.

## TDD Requirements

Add the failing completion-audit assertion first and confirm it fails because
the durable audit does not yet mention the README post-rewrite banner.

## Implementation Requirements

- Update `docs/release/r11-completion-audit-2026-05-14.md`.
- Preserve `Status: NOT ACHIEVED`.
- Do not edit `README.md` before force-push; the banner is post-rewrite
  coordination only.
- Do not mutate refs, tags, branches, backups, mirrors, history, or runtime
  source files.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED completion-audit assertion proves the README banner artifact is
  missing from the durable audit.
- [x] Completion audit maps the README banner requirement to blocked evidence.
- [x] Audit keeps `Status: NOT ACHIEVED` and explicitly avoids treating the
  banner as required before force-push.
- [x] Targeted validation, docs validation, rebrand validation, and whitespace
  checks pass.

## Worklog

Update `docs/worklog/T431-r11-readme-banner-audit-coverage.md`.
