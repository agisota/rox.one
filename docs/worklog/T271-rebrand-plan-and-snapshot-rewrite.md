# T271 - Rebrand plan and snapshot rewrite

## 1. Task summary

Rewrite `plan.md` and `snapshot.md` so active orientation docs use the canonical
ROX.ONE written wordmark, carry the rebrand successor note, and mark the old
snapshot as historical.

## 2. Repo context discovered

- Phase R.4 explicitly scopes `plan.md` and `snapshot.md` as rewritable.
- `plan.md` still uses the spoken-form brand in written text and lacks the
  successor-goal note.
- `snapshot.md` is dated 2026-05-05 and describes the fork with stale product
  phrases from before the rebrand sweep.
- Upstream Craft Agents OSS references remain valid only when describing
  upstream attribution or merge targets.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `plan.md`
- `snapshot.md`
- `scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-doc-cleanup.test.ts` before editing
`plan.md` or `snapshot.md`. The R.4 documentation regression test asserts:

- `plan.md` contains `Successor goal: this rebrand sweep (R.0-R.10).`
- `plan.md` and `snapshot.md` use `ROX.ONE` in active product text.
- `snapshot.md` contains a historical note for the previous snapshot.
- Stale legacy product phrases are gone while upstream attribution remains.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- Result: exit 1.
- Expected failure: T269 and T270 tests passed; the new T271 test failed
  because `plan.md` did not contain
  `Successor goal: this rebrand sweep (R.0-R.10).`

## 6. Implementation changes

- Updated the `plan.md` date/repository header and added the successor-goal
  note.
- Replaced written-form `ROX ONE` product references in `plan.md` with
  `ROX.ONE`.
- Reworded `plan.md` target and upstream/repo lines so legacy names remain
  only in upstream attribution/merge-target context.
- Updated the `snapshot.md` date/repository/branch header for the current R.4
  state.
- Added a `Historical note` marking the previous snapshot as historical.
- Reworded `snapshot.md` executive-summary and architecture lines to use
  ROX.ONE / Agent Workbench Suite product language while preserving upstream
  origin attribution.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `rg -n "ROX ONE|A white-label Craft Agents fork|structurally Craft Agents|Craft permission modes" plan.md snapshot.md`
- `rg -n "Craft|ROX ONE|craft-agent|@craft-agent" plan.md snapshot.md`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`: 3 pass, 0 fail,
  35 assertions.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- Targeted stale-product grep: exit 1 with no matches.
- Broader plan/snapshot grep finds only upstream attribution / upstream merge
  target references.

## 9. Build output summary

Not run for this doc-only ticket.

## 10. Remaining risks

- `plan.md` and `snapshot.md` are whole-file allowlisted by the current
  rebrand validator until later final-grep phases tighten the allowlist.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves plan/snapshot gap | Pass | Red exit 1 on missing successor-goal note before implementation |
| Plan carries successor note and canonical wordmark | Pass | R.4 doc cleanup test passes |
| Snapshot is current and marks prior state historical | Pass | R.4 doc cleanup test passes |
| Upstream attribution remains clear | Pass | Broader grep leaves only upstream references |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T271 task commit in git history |
