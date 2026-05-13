# T322 - Rebrand closeout evidence reconciliation

Status: DONE
Phase: R.10 follow-up evidence repair
Ticket: docs/tickets/T322-rebrand-closeout-evidence-reconciliation.md

## 1. Task summary

Replace placeholder R.10 closeout evidence with concrete commit SHAs and
record the T321 roadmap-gate repair in the closeout mapping.

## 2. Repo context discovered

T321 made `bun run validate:roadmap` green, but
`docs/release/rebrand-mapping-2026-05-13.md` still had a placeholder
closeout slot after PR #71 merged, and the T296 worklog needed an
explicit guard against placeholder commit wording.

## 3. Files inspected

- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/worklog/T296-rebrand-sweep-closeout.md`
- `docs/worklog/T321-roadmap-coherence-validator-repair.md`
- `scripts/__tests__/rebrand-closeout-gates.test.ts`

## 4. Tests added first

`scripts/__tests__/rebrand-permanent-gate.test.ts` now asserts the
release mapping contains the concrete T321 evidence and does not use the
placeholder `this closeout commit` wording.

## 5. Expected failing test output

The first run of `bun test scripts/__tests__/rebrand-closeout-gates.test.ts`
failed because `docs/release/rebrand-mapping-2026-05-13.md` did not
contain the T321 row with commit `afb6596`. After rebasing this
follow-up onto PR #71, the concrete T321 commit is `d0b2528`, and the
regression assertion lives in the merged permanent-gate test file.

## 6. Implementation changes

- Updated `docs/release/rebrand-mapping-2026-05-13.md` with the T321
  follow-up row and the concrete `7cee988` R.10 merge commit.
- Updated `docs/worklog/T296-rebrand-sweep-closeout.md` to remove
  `this closeout commit` placeholder wording and record that `rebrand-v1`
  currently points at the remote R.10 tag target until R.11 re-points it.
- Added a docs-contract assertion to
  `scripts/__tests__/rebrand-permanent-gate.test.ts`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-closeout-gates.test.ts` (red, before rebase)
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- `bun test scripts/__tests__/roadmap-coherence-validator.test.ts
  scripts/__tests__/rebrand-permanent-gate.test.ts`: 6 pass, 0 fail,
  10 expects after rebasing on top of PR #71.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden
  tokens outside the allowlist`.
- `bun run validate:docs`: agent-contract, architecture-docs, and
  sync-v2-design validators passed.
- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills,
  226 tickets, 7 required docs`.
- `bun run validate:roadmap`: `validate:roadmap OK — 46 phases, 111
  tickets across detail files`.
- `bun run typecheck`: completed successfully.
- `bun run lint`: completed successfully.
- `git diff --check`: clean.

## 9. Build output summary

Not run. This ticket changes tests and documentation only; the prior
T321 full build remains the runtime-behavior evidence for the current
branch.

## 10. Remaining risks

R.11 is still blocked by hard prerequisites; this ticket only reconciles
R.10 evidence and does not rewrite history or re-point tags.

## 11. Acceptance criteria matrix

- [x] The new docs-contract test fails before implementation.
- [x] The release mapping includes T321 and `d0b2528`.
- [x] The T296 worklog no longer uses `this closeout commit`.
- [x] Rebrand/docs/agent-contract gates stay green.
- [x] Worklog complete.
