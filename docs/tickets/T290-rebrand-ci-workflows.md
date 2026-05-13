# T290 - Rebrand CI workflow environment and artifact surfaces

Status: DONE

## Context

Phase R.7 owns the rebrand of GitHub Actions job/step `name:` keys and
artifact prefixes. The R.5 + R.6 surface sweeps already migrated these
to the canonical `ROX ONE` voice. T290's job is to encode that contract
as a regression test so the next time someone copies a workflow they
cannot regress the brand.

Legacy `ROX_*` env-var keys in workflow YAML (`ROX_E2E_FAKE_PROVIDERS`,
`ROX_HEADLESS`, `ROX_DEV_RUNTIME`, the `ROX_ANTHROPIC_API_KEY`
secret reference) are deliberately preserved here — they exercise the
R.6 `readEnv()` shim's legacy fallback path, and renaming them would
prematurely retire the deprecation window that R.6 explicitly granted
"one minor version". They are queued for an R.8+ pass that aligns with
the shim's removal.

## Goal

Lock in the ROX-owned job/step name + artifact-name contract for every
file under `.github/workflows/` via a Bun test that fails if any future
edit reintroduces `Rox` in a name key or `rox-agent-` as an artifact
prefix.

## Required UI

None.

## Required Data/API

No runtime API changes.

## Required Automations

Update GitHub Actions workflow env names and their local validators.

## Required Subagents

None.

## TDD Requirements

The R.7 regression test in
`scripts/__tests__/r7-docker-ci-build.test.ts` includes two workflow
contracts:

1. No file under `.github/workflows/` has a `name:` key whose value
   contains `Rox` or `rox-agent` (case-insensitive `Rox` plus
   exact `rox-agent`).
2. No file under `.github/workflows/` contains any `rox-agent-*`
   artifact prefix.

Both assertions are green on the current main; T290 locks them as a
regression contract.

## Implementation Requirements

No source edits required — the contract is encoded in the test only.
Do NOT rename ROX_* env-var keys in workflow YAML during R.7; those
are intentionally preserved to keep the R.6 `readEnv()` shim's
deprecation-warning code path exercised in CI.

External GitHub secret names (e.g. `ROX_ANTHROPIC_API_KEY`) are owned
by the org-level secret store and require an operator-side rename
before any workflow reference can change.

## Validation Commands

- `bun test scripts/__tests__/r7-docker-ci-build.test.ts`
- `bun run validate:rebrand` (no regression in workflows bucket)
- `git diff --check`

## Acceptance Criteria

- [x] R.7 test asserts the name-key + artifact-name contract is green.
- [x] No workflow file is edited during T290.
- [x] ROX_* env-var keys remain in workflow YAML to exercise the
      R.6 shim.

## Worklog

Update `docs/worklog/T290-rebrand-ci-workflows.md`.
