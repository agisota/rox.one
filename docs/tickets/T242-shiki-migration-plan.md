# T242 - Shiki Migration Plan

Status: DONE

## Context

Phase 11 of the master roadmap calls for the F.1 Shiki migration. The research
artifact at commit `09c5fc1` compared three implementation paths:

- Option A: curated preloaded language/theme subset on the JS-regex engine.
- Option B: curated preload plus dynamic on-demand language loading.
- Option C: engine swap while preserving broad language/theme metadata.

PR #85 landed the first shared adapter code, but did not land the required
ADR 0010 or plan ticket. This ticket restores the Phase 11 decision record
and names the follow-up repair ticket that completes the merged adapter slice.

## Goal

Record the Phase 11 option decision in
`docs/decision-records/audit-harness/0010-shiki-highlighter.md`, register the
ADR, and bind T336 as the repair ticket for the already-merged adapter core.

## Required UI

None. This ticket is planning and decision-record work.

## Required Data/API

The plan reserves `@rox-one/shared/highlight` as the adapter export. PR #85
already added the export; T336 records and repairs that implementation slice.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

No red/green product test is required for this planning ticket. The acceptance
gate is repository validation:

```text
bun run validate:docs
bun run validate:roadmap
```

## Implementation Requirements

- Add ADR `0010-shiki-highlighter.md`.
- Update `docs/decision-records/audit-harness/README.md` with ADR 0010.
- Add this ticket and the matching worklog.
- Keep runtime source changes in T336, not this planning ticket.

## Validation Commands

- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] ADR 0010 exists and chooses the adapter approach.
- [x] ADR 0010 rejects the non-selected options with rationale.
- [x] ADR register links ADR 0010.
- [x] T336 is named as the repair/implementation metadata ticket.
- [x] Worklog exists and uses the 11-section format.

## Worklog

See `docs/worklog/T242-shiki-migration-plan.md`.
