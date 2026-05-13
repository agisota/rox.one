# T324 - Rebrand follow-up SHA drift guard

Status: DONE
Phase: R.10 follow-up evidence repair
Ticket: docs/tickets/T324-rebrand-followup-sha-drift-guard.md

## 1. Task summary

Refresh the R.10 follow-up closeout evidence after rebasing onto PR #72
and make the permanent gate detect future stale T321 SHA references.

## 2. Repo context discovered

After rebasing onto `baadce6`, T321 became a new local commit, while
`docs/release/rebrand-mapping-2026-05-13.md`,
`docs/tickets/T322-rebrand-closeout-evidence-reconciliation.md`,
`docs/worklog/T322-rebrand-closeout-evidence-reconciliation.md`, and the
permanent gate still expected the previous row.
After later rebases onto `6d6e23a`, `21f4543`, and `533d837`, the same gate
caught additional drift; the current post-PR #75 T321 commit is `f82da7f`.

## 3. Files inspected

- `scripts/__tests__/rebrand-permanent-gate.test.ts`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/tickets/T322-rebrand-closeout-evidence-reconciliation.md`
- `docs/worklog/T322-rebrand-closeout-evidence-reconciliation.md`
- `.swarm/master-roadmap-log.md`

## 4. Tests added first

`scripts/__tests__/rebrand-permanent-gate.test.ts` now derives the current
T321 commit from git before checking the release mapping.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-permanent-gate.test.ts` first failed
because the revised gate expected the current T321 commit row while
`docs/release/rebrand-mapping-2026-05-13.md` still contained the stale
pre-rebase row. After the later PR #73 rebase, it failed again because the
gate expected the current T321 commit while the mapping still contained the
previous T321 row.

## 6. Implementation changes

- Updated the R.10 permanent gate to derive the current T321 commit from
  git before checking release mapping evidence.
- Updated `docs/release/rebrand-mapping-2026-05-13.md` to record the
  post-PR #75 T321 commit `f82da7f`.
- Updated the T322 ticket/worklog evidence wording so it requires the
  current concrete T321 SHA instead of naming the rebased-away SHA.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` (red)
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` (green)
- `bun run validate:rebrand`
- `bun run validate:docs`
- `bun run validate:agent-contract`
- `bun run validate:roadmap`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts`: 5 pass, 0 fail,
  8 expects.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden tokens
  outside the allowlist`.
- `bun run validate:docs`: passed with agent-contract, architecture-docs, and
  sync-v2-design checks green; agent contract reported 11 skills, 231 tickets,
  and 7 required docs.
- `bun run validate:agent-contract`: passed with 11 skills, 231 tickets, and 7
  required docs.
- `bun run validate:roadmap`: `validate:roadmap OK -- 46 phases, 111 tickets
  across detail files`.
- `bun run typecheck`: completed successfully.
- `bun run lint`: completed successfully.
- `git diff --check`: no whitespace errors.
- `bun test`: 5193 pass, 13 skip, 0 fail, 1 snapshot, 13319 expects across
  5206 tests in 472 files.

## 9. Build output summary

`bun run build` completed successfully after this repair. Electron main,
preload, renderer, resources, and assets builds completed; the only observed
output of note was the existing Vite large-chunk warning.

## 10. Remaining risks

R.11 is still blocked by hard prerequisites; this ticket only repairs
closeout evidence after a local rebase.

## 11. Acceptance criteria matrix

- [x] The revised permanent gate fails before docs are refreshed.
- [x] The release mapping records T321 as `f82da7f`.
- [x] T322 ticket/worklog evidence no longer names the stale T321 SHA.
- [x] Rebrand/docs/roadmap/typecheck/lint/test/build gates stay green.
- [x] Worklog complete.
