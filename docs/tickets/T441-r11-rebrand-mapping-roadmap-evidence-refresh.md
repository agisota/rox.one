# T441 - R.11 rebrand mapping roadmap evidence refresh

Status: DONE

## Context

T439 extended `bun run validate:roadmap` so it now reports
`validate:roadmap OK — 46 phases, 110 tickets across detail files, 14 rebrand
master-roadmap log rows`. The release mapping still records an older roadmap
gate output with `111 tickets across detail files`, which is stale report-only
evidence for a global artifact the R.11 completion audit checks.

## Goal

Refresh the rebrand mapping report's roadmap-gate evidence so it matches the
current validator output and names the T439 ledger hardening.

## Required UI

None.

## Required Data/API

No runtime data or API changes.

## Required Automations

- Extend the permanent rebrand gate test so the mapping report must contain the
  current `validate:roadmap` output.
- No R.11 destructive commands are allowed.

## Required Subagents

None. The task is isolated to a report-only release artifact and its existing
docs-contract test.

## TDD Requirements

- Add a failing test that compares the mapping report with the live
  `scripts/validate-roadmap-coherence.cjs` output.
- Confirm RED before editing the mapping report.

## Implementation Requirements

- Update only the roadmap-gate evidence in
  `docs/release/rebrand-mapping-2026-05-13.md`.
- Do not replace the R.11 `BLOCKED - pending destructive rewrite closeout SHA`
  row.
- Do not mutate tags, create backup artifacts, create an offline mirror, run
  `git filter-repo`, force-push, or clean branches.

## Validation Commands

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:roadmap`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run rebrand:r11-preflight` (expected red while hard blockers remain)

## Acceptance Criteria

- [x] RED assertion fails on stale mapping roadmap-gate output.
- [x] Mapping report contains the current `validate:roadmap` output.
- [x] Mapping report still keeps the R.11 closeout SHA row blocked.
- [x] Targeted test and validators pass.
- [x] No destructive R.11 action is performed.
