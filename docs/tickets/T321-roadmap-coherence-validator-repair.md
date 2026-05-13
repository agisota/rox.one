# T321 - Roadmap coherence validator repair

Status: DONE

## Context

The R.10 closeout validation matrix includes `bun run validate:roadmap`.
After the R.10 sweep is otherwise green, that gate still exits 1 because
the validator only accepts fully qualified `# Phase M.x` / `# Phase P.x`
headings and treats prerequisite ticket references in the rebrand goal as
duplicate ticket ownership.

## Goal

Make the roadmap coherence validator enforce the current roadmap contract:
master-roadmap owns `M.*` phase headings written as `# Phase 2` /
`### Phase 1.1`, the spine owns `P.*` headings written as `### P.1`,
and cross-file prerequisite references do not count as duplicate ticket
definitions.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

`bun run validate:roadmap` must exit 0 and a regression test must cover
the gate so future roadmap edits cannot reintroduce the false failures.

## Required Subagents

None. The failure is isolated to one deterministic script plus docs
evidence.

## TDD Requirements

Add a regression test that runs `scripts/validate-roadmap-coherence.cjs`
against the current roadmap files and expects success. Confirm it fails
before changing the validator.

## Implementation Requirements

1. Preserve the validator's duplicate ticket protection.
2. Recognize master-roadmap numeric phase headings as `M.*`.
3. Recognize spine post-v1 headings as `P.*`.
4. Exclude documented prerequisite ticket cross-references from the
   duplicate-definition check.
5. Keep the change local to the validator, tests, ticket, and worklog.

## Validation Commands

- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] The new regression test fails before implementation.
- [x] `bun run validate:roadmap` exits 0.
- [x] Existing rebrand validator still exits 0.
- [x] Typecheck and lint remain green.
- [x] Worklog complete.

## Worklog

Update `docs/worklog/T321-roadmap-coherence-validator-repair.md`.
