# T288 - Rebrand env-var deprecation warning coverage

Status: IN_PROGRESS
Phase: R.6
Ticket: docs/tickets/T288-rebrand-env-var-deprecation-warning-coverage.md

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

Filled at green.

## 9. Build output summary

Filled at green.

## 10. Remaining risks

- Some legacy ROX_* call sites for *non-canonical* vars (e.g.
  ROX_AUTH_JWT_SECRET, ROX_VITE_PORT) remain. Those are NOT R.6's
  scope; they belong to R.7 (Docker/CI/build rebrand) and the
  community-link/closeout phases.
- The legacy fallback path is documented to be removed after one minor
  version. R.10 will add the prepush hook that enforces the
  `validate:rebrand` gate going forward.

## 11. Acceptance criteria matrix

Filled at green.
