# T339 - Rebrand follow-up SHA drift after README rebase

Status: DONE
Phase: R.10 follow-up evidence repair
Ticket: docs/tickets/T339-rebrand-followup-sha-drift-after-readme-rebase.md

## 1. Task summary

Refresh the R.10 follow-up closeout mapping after replaying the validation
repair branch onto the current canonical `origin/main`.

## 2. Repo context discovered

`scripts/__tests__/rebrand-permanent-gate.test.ts` derives the expected T321
commit abbreviation from
`git log -1 --format=%h -- docs/tickets/T321-roadmap-coherence-validator-repair.md`.
On the current canonical history, Git reports the T321 commit as `c42e3d59`,
while `docs/release/rebrand-mapping-2026-05-13.md` still recorded the
rewritten-history value `f82da7f`.

An earlier full-suite rerun in `/tmp/rox-m11-repair` also showed why `/tmp`
was unsuitable for final evidence: the worktree disappeared mid-run and Bun
reported `ENOENT` / `Cannot find module` for files under
`packages/shared/src/...`. A later worktree under `/home/dev/craft/worktrees`
was also removed by the external cleanup process, so final repair work moved to
`/home/dev/rox-m11-repair`.

## 3. Files inspected

- `scripts/__tests__/rebrand-permanent-gate.test.ts`
- `docs/release/rebrand-mapping-2026-05-13.md`
- `docs/tickets/T327-rebrand-followup-sha-drift-after-t227.md`
- `docs/worklog/T327-rebrand-followup-sha-drift-after-t227.md`

## 4. Tests added first

No new test file was needed. The existing dynamic permanent gate already
checks the current T321 commit abbreviation.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-permanent-gate.test.ts` failed because the
gate expected `| R.10 follow-up | T321 | `c42e3d59` |`, while the release
mapping still contained `f82da7f`.

## 6. Implementation changes

Updated `docs/release/rebrand-mapping-2026-05-13.md` to record T321 as
`c42e3d59`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` (red)
- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts scripts/__tests__/rebrand-permanent-gate.test.ts`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Combined documentation gates:
  9 pass, 0 fail, 56 expect calls.
- `bun run validate:docs`:
  agent contract, architecture docs, and sync docs passed.
- `bun run validate:roadmap`:
  46 phases and 111 tickets validated.
- `bun run validate:rebrand`:
  no forbidden tokens outside the allowlist.
- Full suite:
  5592 pass, 13 skip, 0 fail, 1 snapshot, 23737 expect calls.
- Static gates:
  `bun run typecheck`, `bun run lint`, and `git diff --check` exited 0.

## 9. Build output summary

No build was required for the documentation-only evidence repair itself, but
the branch runtime validation completed with `bun run build` exit 0.

## 10. Remaining risks

No known remaining test failures. The branch still needs final integration with
the latest `origin/main` before completion because `origin/main` advanced while
the local repairs were in progress.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| The permanent gate fails before implementation for the expected SHA drift | Green | Targeted gate expected `c42e3d59` while mapping had `f82da7f` |
| Release mapping records T321 as `c42e3d59` | Green | Mapping row updated |
| Permanent gate passes after the mapping repair | Green | Combined documentation gates: 9 pass, 0 fail |
| Docs/roadmap/rebrand validators pass | Green | `validate:docs`, `validate:roadmap`, and `validate:rebrand` exit 0 |
| Full `bun test` passes | Green | 5592 pass, 13 skip, 0 fail |
| No runtime files are changed | Green | Documentation-only diff |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
