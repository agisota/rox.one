# T270 - Rebrand security and code-of-conduct docs

## 1. Task summary

Rewrite active policy documentation in `CODE_OF_CONDUCT.md` and `SECURITY.md`
so reporting contacts and scoped package references use canonical ROX.ONE
values.

## 2. Repo context discovered

- Phase R.4 explicitly scopes `CODE_OF_CONDUCT.md` and `SECURITY.md` as
  rewritable policy docs.
- `CODE_OF_CONDUCT.md` still reports enforcement issues to `legal@rox.one`.
- `SECURITY.md` already reports vulnerabilities to `security@rox.one`, but its
  scope still names the legacy package namespace.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-doc-cleanup.test.ts` before editing
`CODE_OF_CONDUCT.md` or `SECURITY.md`. The R.4 documentation regression test
asserts:

- Code of Conduct uses `conduct@rox.one`, not `legal@rox.one`.
- Security policy uses `security@rox.one`.
- Security scope names `@rox-one/*`, not the legacy package scope.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- Result: exit 1.
- Expected failure: T269 test passed and the new T270 test failed because
  `CODE_OF_CONDUCT.md` did not contain `conduct@rox.one`; the received body
  still used `legal@rox.one`.

## 6. Implementation changes

- Updated `CODE_OF_CONDUCT.md` enforcement reporting contact from
  `legal@rox.one` to `conduct@rox.one`.
- Updated `SECURITY.md` package-scope policy text from the legacy package
  namespace to `@rox-one/*`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `rg -n "legal@rox\\.one|@craft-agent/" CODE_OF_CONDUCT.md SECURITY.md`

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`: 2 pass, 0 fail,
  23 assertions.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- Targeted policy-doc legacy grep: exit 1 with no matches.

## 9. Build output summary

Not run for this doc-only ticket.

## 10. Remaining risks

- Later R.5 package-scope runtime renames remain out of scope for this policy
  doc cleanup.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves policy-doc gap | Pass | Red exit 1 on missing `conduct@rox.one` before implementation |
| Code of Conduct uses `conduct@rox.one` | Pass | R.4 doc cleanup test passes |
| Security policy uses canonical contact and scope | Pass | R.4 doc cleanup test passes |
| Validation evidence recorded | Pass | Commands and outputs summarized above |
| Worklog complete | Pass | This 11-section worklog is complete |
| Commit created | Pass | This worklog is included in the T270 task commit in git history |
