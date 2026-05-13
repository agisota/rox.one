# T338 - README acknowledgements contract repair

Status: DONE
Phase: R.6 support
Ticket: docs/tickets/T338-readme-acknowledgements-contract-repair.md

## 1. Task summary

Restore the documentation attribution and source-checkout smoke contract
required by the rebrand documentation tests after the README rewrite landed on
`origin/main`.

## 2. Repo context discovered

`scripts/__tests__/rebrand-doc-cleanup.test.ts` reads the README, extracts the
`## Acknowledgements` section, and requires that section to contain
the upstream OSS URL. The same test also requires the README to document the
source-checkout `rox-cli` alias and requires `snapshot.md` to carry the same
upstream URL as legal-preserve attribution.

The README rewrite on `origin/main` retained the ROX.ONE setup instructions but
removed the acknowledgement section and the CLI smoke snippet. The current
canonical-history snapshot retained the upstream merge note but not the
legal-preserve URL required by the contract.

## 3. Files inspected

- `README.md`
- `snapshot.md`
- `scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 4. Tests added first

No new test was needed. The existing contract test was the red check:

`bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`

## 5. Expected failing test output

The red run failed in `R.4 documentation rebrand cleanup`:

- The README acknowledgement section did not contain the required upstream OSS
  URL.
- After restoring that section, the same contract requires
  `alias rox-cli="bun run $(pwd)/apps/cli/src/index.ts"`.
- On the canonical branch replay, the same targeted test also failed because
  `snapshot.md` did not contain the required upstream OSS URL.

## 6. Implementation changes

- Added a `## Acknowledgements` section to `README.md` with the upstream OSS
  URL and a short note that license/notice attribution remains preserved in the
  legal documents.
- Restored the source-checkout CLI smoke snippet with the `rox-cli` alias and
  `rox-cli ping` command.
- Added the legal-preserve upstream attribution URL to the snapshot upstream
  context block.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts` (red)
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
  46 phases and 110 tickets validated.
- `bun run validate:rebrand`:
  no forbidden tokens outside the allowlist.
- Full suite:
  6190 pass, 13 skip, 0 fail, 1 snapshot, 25152 expect calls.
- Static gates:
  `bun run typecheck`, `bun run lint`, and `git diff --check` exited 0.

## 9. Build output summary

No build was required for the documentation-only repair itself, but the branch
runtime validation completed with `bun run build` exit 0.

## 10. Remaining risks

No known remaining test failures.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| README contains `## Acknowledgements` with the upstream URL | Green | README section restored |
| README contains the source-checkout `rox-cli` smoke snippet | Green | README snippet restored |
| `snapshot.md` contains the legal-preserve upstream URL | Green | Snapshot upstream block updated |
| Rebrand doc cleanup contract passes | Green | Combined documentation gates: 9 pass, 0 fail |
| Docs/roadmap/rebrand validators pass | Green | `validate:docs`, `validate:roadmap`, and `validate:rebrand` exit 0 |
| Full `bun test` passes | Green | 6190 pass, 13 skip, 0 fail |
| No runtime files are changed | Green | Documentation-only diff |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
