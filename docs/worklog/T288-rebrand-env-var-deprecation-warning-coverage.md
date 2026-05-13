# T288 - Rebrand env-var deprecation warning coverage

Status: DONE
Phase: R.6
Ticket: docs/tickets/T288-rebrand-env-var-deprecation-warning-coverage.md
R.6 merge evidence: `777ada7` (`Complete R.6 env-var rename with readEnv() shim (#66)`)

## 1. Task summary

Closeout ticket for Phase R.6. Reruns the T285 deprecation cadence tests
under the full `bun test` suite, captures the validation matrix, and
appends the phase ledger line.

## 2. Repo context discovered

After T285+T286+T287 land, the R.6 stopping conditions per
`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`:

- All canonical-16 runtime call sites use `readEnv()`.
- The deprecation-warning test passes.
- README, `Dockerfile.server`, `.env.example`, and root `package.json`
  scripts use `ROX_*`.

## 3. Files inspected

- `docs/worklog/T285-*.md`
- `docs/worklog/T286-*.md`
- `docs/worklog/T287-*.md`
- `.swarm/master-roadmap-log.md`

## 4. Tests added first

No new tests in T288. The closeout asserts the test file from T285
still encodes the cadence: warn-on-first-read, no-warn-on-subsequent-read,
separate-warn-per-legacy-var.

## 5. Expected failing test output

N/A — closeout ticket.

## 6. Implementation changes

Worklog only. The phase ledger line is appended in the final commit of
the PR; SHA is captured post-merge by the operator.

## 7. Validation commands run

Full matrix (see T286 worklog for output).

## 8. Passing test output summary

- `bun test packages/shared/src/utils/__tests__/env-compat.test.ts`: 6 pass,
  0 fail, 17 expect calls.
- Full `bun test`: 5258 pass, 13 skip, 0 fail, 1 snapshot, 13419 expects
  across 5271 tests in 476 files.
- `bun run validate:rebrand`: `rebrand validation passed: no forbidden
  tokens outside the allowlist`.
- `bun run validate:roadmap`: `validate:roadmap OK -- 46 phases, 111 tickets
  across detail files`.
- `.swarm/master-roadmap-log.md` records
  `rebrand-R.6-env-var-shim | 777ada7 | T285,T286,T287,T288`.

## 9. Build output summary

`bun run build` completed successfully. Electron main, preload, renderer,
resources, and assets builds completed; the only observed output of note was
the existing Vite large-chunk warning.

## 10. Remaining risks

- Some legacy CRAFT_* call sites for *non-canonical* vars (e.g.
  CRAFT_AUTH_JWT_SECRET, CRAFT_VITE_PORT) remain. Those are NOT R.6's
  scope; they belong to R.7 (Docker/CI/build rebrand) and the
  community-link/closeout phases.
- The legacy fallback path is documented to be removed after one minor
  version. R.10 will add the prepush hook that enforces the
  `validate:rebrand` gate going forward.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
|---|---|---|
| All four T285-T288 tickets carry a referenced commit SHA | Pass | T285, T286, T287, and T288 ticket metadata reference R.6 merge commit `777ada7` |
| Deprecation warning test passes locally and in the focused run | Pass | Focused env-compat test: 6 pass, 0 fail, 17 expects |
| Phase ledger line appended for `rebrand-R.6-env-var-shim` | Pass | `.swarm/master-roadmap-log.md` records `rebrand-R.6-env-var-shim | 777ada7 | T285,T286,T287,T288` |
| No regression beyond the 1-test budget on full `bun test` | Pass | Full `bun test`: 5258 pass, 13 skip, 0 fail |
