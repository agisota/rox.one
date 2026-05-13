# T321 - Roadmap coherence validator repair

Status: DONE
Phase: R.10 follow-up gate repair
Ticket: docs/tickets/T321-roadmap-coherence-validator-repair.md

## 1. Task summary

Repair `bun run validate:roadmap` so it validates the current roadmap
format instead of failing on valid master-roadmap and spine phase heading
styles or prerequisite ticket references.

## 2. Repo context discovered

The R.10 rebrand closeout is locally green for `validate:rebrand`,
typecheck, lint, full `bun test`, and build. The remaining red gate is
`bun run validate:roadmap`, which reports 36 violations: missing phase
headings for M/P ledger rows and duplicate ownership for T223/T229.

## 3. Files inspected

- `scripts/validate-roadmap-coherence.cjs`
- `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-closeout-gates.test.ts`

## 4. Tests added first

`scripts/__tests__/roadmap-coherence-validator.test.ts` runs the roadmap
coherence validator against the current repository roadmaps and expects a
zero exit.

## 5. Expected failing test output

Before implementation, the new regression test fails because the
validator exits 1 and reports 36 roadmap violations.

## 6. Implementation changes

- Added `scripts/__tests__/roadmap-coherence-validator.test.ts` so the
  roadmap gate is covered by the normal test suite.
- Updated `scripts/validate-roadmap-coherence.cjs` to recognize:
  - master-roadmap numeric headings such as `# Phase 2` as `M.2`;
  - the Phase 1 closeout heading as `M.1.7`;
  - spine-owned post-release headings such as `### P.1` as `P.1`.
- Changed duplicate-ticket detection to compare owned ticket ranges:
  master-roadmap owns pre-rebrand tickets through T259; rebrand-sweep
  owns T260-T299. This keeps prerequisite cross-references such as
  T223/T229 from being treated as duplicate definitions.
- Repaired roadmap evidence drift for the completed C.4 follow-on split:
  T215 is server-core RPC scope migration, T216 is Pi IPC propagation,
  T217 is tenant credential KDF, T218-T221 are audit backend tickets,
  T222 is migration tooling, and T223 is Phase 1 closeout.

## 7. Validation commands run

- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts` (red)
- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `git diff --check`

## 8. Passing test output summary

- Targeted roadmap test: 1 pass, 0 fail, 2 expect calls.
- `bun run validate:roadmap`: `validate:roadmap OK — 46 phases, 111
  tickets across detail files`.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden
  tokens outside the allowlist`.
- `bun run typecheck`: completed successfully.
- `bun run lint`: completed successfully.
- Full `bun test`: 5154 pass, 13 skip, 0 fail, 1 snapshot, 13278
  expect calls, 5167 tests across 470 files.
- `git diff --check`: clean.

## 9. Build output summary

`bun run build` completed successfully. The existing Vite warning about
chunks larger than 500 kB after minification remains present; no new
build failure was introduced.

## 10. Remaining risks

- The roadmap validator now relies on the documented ticket-number lane
  ownership ranges. If the roadmap intentionally moves a ticket between
  lanes, the range rule must be updated in the same commit.
- R.11 remains blocked by its hard prerequisites and was not started by
  this ticket.

## 11. Acceptance criteria matrix

- [x] The new regression test fails before implementation.
- [x] `bun run validate:roadmap` exits 0.
- [x] Existing rebrand validator still exits 0.
- [x] Typecheck and lint remain green.
- [x] Worklog complete.
