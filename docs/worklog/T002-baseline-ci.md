# T002 Baseline CI and Validation Gate Worklog

## Task summary

Make the baseline GitHub Actions validation workflow enforce Agent Workbench contract checks, docs checks, CI contract checks, and validation log upload.

## Repo context discovered

The repository already had `.github/workflows/validate.yml` running Bun install plus `bun run validate:ci`, and `.github/workflows/validate-server.yml` for manual integration validation across operating systems. T002 strengthens the existing Validate workflow instead of adding a parallel duplicate workflow.

## Files inspected

Discovery used these files:
- `.github/workflows/validate.yml`
- `.github/workflows/validate-server.yml`
- `package.json`
- `scripts/validate-agent-contract.ts`

## Tests added first

Added `scripts/validate-ci-contract.ts` before implementation. It checks package scripts, workflow required steps, upload-artifact configuration, and a corrupt skill metadata fixture through `AGENT_CONTRACT_ROOT`.

## Expected failing test output

Command:

```sh
bun run scripts/validate-ci-contract.ts
```

Expected red-phase output:

```text
[ci-contract] package.json missing script: validate:ci-contract
```

## Implementation changes

Created:
- `scripts/validate-ci-contract.ts`
- `docs/worklog/T002-baseline-ci.md`

Updated:
- `.github/workflows/validate.yml`
- `package.json`
- `scripts/validate-agent-contract.ts`

## Validation commands run

```sh
bun run validate:agent-contract
bun run validate:architecture-docs
bun run validate:ci-contract
bun run validate:ci
git diff --check -- .github/workflows/validate.yml package.json scripts/validate-agent-contract.ts scripts/validate-ci-contract.ts docs/worklog/T002-baseline-ci.md
```

## Passing test output summary

`validate:agent-contract`, `validate:architecture-docs`, `validate:ci-contract`, and `validate:ci` passed. `validate:ci` completed typecheck, shared config tests, document tool smoke tests, and i18n parity.

## Build output summary

T002 changes CI and validation scripts only. No desktop or web app build is required for this ticket.

## Remaining risks

`validate:ci` still reflects the existing project validation surface. Broader unit/build matrices belong to later release and Mac ARM tickets.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| CI runs install | PASS | `.github/workflows/validate.yml` includes `bun install --frozen-lockfile` |
| CI runs tests/validation | PASS | Workflow runs `validate:agent-contract`, `validate:architecture-docs`, and `validate:ci` |
| CI fails on broken skill metadata | PASS | `validate:ci-contract` corrupt fixture expects validator failure |
| CI fails on missing required docs | PASS | `validate:agent-contract` and `validate:architecture-docs` are required gates |
| CI uploads validation logs | PASS | Workflow uses `actions/upload-artifact@v4` for `.ci-logs/**/*.log` |
| Local equivalent commands pass | PASS | `bun run validate:ci` |
