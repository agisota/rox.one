# T468 - R.11 unified remaining worklist

Status: DONE

## Context

R.11 has several report-only inventories and operator decision manifests. The
operator needs one ordered list of every remaining correction, merge/retire
decision, gate, and validation step before continuing.

## Goal

Extend the active R.11 consolidation backlog so it is the canonical full
remaining-worklist surface for the current mainline state.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- Extend the R.11 completion-audit regression so the consolidation backlog must
  include the full remaining-worklist phases, exact blocker IDs, current PR and
  branch counts, history-scan count, and destructive-window guard language.

## Required Subagents

Use read-only subagents for independent inventory and planning checks when
available.

## TDD Requirements

- Add the failing audit regression before extending the backlog.
- Confirm RED because the backlog does not yet contain the unified worklist
  section.

## Implementation Requirements

- Keep this ticket report-only.
- Do not delete branches, mutate tags, create backup refs, create mirrors, run
  `git filter-repo`, force-push, clear `/goal`, or call `update_goal`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-completion-audit.test.ts`
- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails because the backlog lacks the unified worklist.
- [x] Worklist records default preflight blockers.
- [x] Worklist records pre-rewrite blockers.
- [x] Worklist records open PR count 0 and remote branch review count 150.
- [x] Worklist records fork, tag, backup, legal, history-scan, rewrite, and
  post-rewrite closeout phases.
- [x] Worklist preserves explicit no-destructive-action guard language.
- [x] Targeted tests and validators pass.
- [x] No destructive R.11 action is performed.
