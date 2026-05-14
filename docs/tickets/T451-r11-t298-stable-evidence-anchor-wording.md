# T451 - R.11 T298 stable evidence anchor wording

Status: DONE

## Context

T298's closeout worklog points readers at durable report-only evidence, but one
section still says "The latest report-only evidence chain is" while naming an
older T439/T441/T442 set. T449 and T450 have now landed, so the label is
misleading and will keep drifting as report-only guardrails evolve.

## Goal

Make the T298 evidence-pointer wording stable: keep the useful anchor tickets,
add the current T449/T450 target-guard anchors, and stop calling the list the
"latest" chain.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

- Extend `scripts/__tests__/rebrand-r11-preflight.test.ts` so T298's evidence
  pointer cannot regress to "latest" wording and must name T449/T450.

## Required Subagents

None. This is a narrow report-only documentation/test hardening slice.

## TDD Requirements

- Add the failing T298 documentation regression before editing T298.
- Confirm RED because T298 still uses the stale "latest" label and lacks
  T449/T450 anchor bullets.

## Implementation Requirements

- Update only the T298 worklog, the T298 documentation regression, and this
  ticket/worklog pair.
- Keep T298 `Status: BLOCKED`.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-preflight.test.ts`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## Acceptance Criteria

- [x] RED assertion fails on the stale "latest" evidence-chain wording.
- [x] T298 worklog uses stable evidence-anchor wording.
- [x] T298 worklog names T449 and T450.
- [x] T298 remains `Status: BLOCKED`.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
