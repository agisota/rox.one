# T338 - README acknowledgements contract repair

Status: DONE
Phase: R.6 support
Ticket: docs/tickets/T338-readme-acknowledgements-contract-repair.md

## 1. Task summary

Restore the README acknowledgement section required by the rebrand
documentation contract after the README rewrite on `origin/main`.

## 2. Repo context discovered

`scripts/__tests__/rebrand-doc-cleanup.test.ts` reads the README, extracts the
`## Acknowledgements` section, and requires that section to contain
`https://github.com/lukilabs/craft-agents-oss`. The README rewrite on
`origin/main` retained the ROX.ONE setup instructions but removed the section
and the CLI smoke snippet, so the contract test failed against the simplified
README.

## 3. Files inspected

- `README.md`
- `scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 4. Tests added first

No new test was needed. The existing contract test was the red check:

`bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 5. Expected failing test output

The red run failed in `R.4 documentation rebrand cleanup > rewrites README and
contributing setup docs to ROX.ONE naming`:

`Expected to contain: "https://github.com/lukilabs/craft-agents-oss"`

The received acknowledgement section was empty.

After restoring that section, the same test exposed the next missing README
contract:

`Expected to contain: "alias rox-cli=\"bun run $(pwd)/apps/cli/src/index.ts\""`

## 6. Implementation changes

Added a `## Acknowledgements` section to `README.md` with the upstream OSS URL
and a short note that license/notice attribution remains preserved in the legal
documents. Restored the source checkout CLI smoke snippet with the `rox-cli`
alias and `rox-cli ping` command.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun run validate:docs`
- `bun run validate:roadmap`
- `bun run validate:rebrand`
- `git diff --check`
- `bun test packages/shared/src/auth/__tests__/oauth.e2e.test.ts`

## 8. Passing test output summary

- Rebrand doc cleanup contract: `4 pass, 0 fail, 48 expect() calls`.
- Docs validators: `validate:docs`, `validate:roadmap`, and
  `validate:rebrand` exited 0.
- Whitespace check: `git diff --check` exited 0.
- OAuth E2E timeout follow-up: targeted
  `packages/shared/src/auth/__tests__/oauth.e2e.test.ts` passed with
  `7 pass, 0 fail, 11 expect() calls`.

## 9. Build output summary

No build needed for this documentation-only repair.

## 10. Remaining risks

The full post-rebase suite also showed external OAuth metadata E2E timeouts.
Those are tracked separately from this README contract repair until targeted
repro confirms whether they are transient network failures or a local test
contract issue.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| README contains `## Acknowledgements` with the upstream URL | Green | README section restored |
| Rebrand doc cleanup contract passes | Green | `4 pass, 0 fail` |
| Docs/roadmap/rebrand validators pass | Green | `validate:docs`, `validate:roadmap`, `validate:rebrand`, `git diff --check` exited 0 |
| Full `bun test` passes | Pending | Blocked by external OAuth timeout investigation |
| No runtime files are changed | Green | README plus ticket/worklog docs only |
| Worklog complete | Pending | Full-suite evidence pending |
| Commit created | Green | Atomic commit after validation |
