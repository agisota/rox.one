# T070 - Private CI/CD Release Pipeline

Status: DONE

## Goal

Make private GitHub release validation reproducible for the ROX ONE Agent
Workbench integration branch.

## Scope

- Add a private release workflow contract covering docs, lint, typecheck, full
  deterministic tests, Electron build, Mac ARM workflow validation, and private
  artifact upload.
- Add a local full release gate script surface.
- Keep Mac ARM packaging in the existing dedicated macOS ARM64 workflow.
- Do not commit secrets, runtime logs, or generated local state.

## Required Tests

- Add a validator that fails when private release workflow/scripts/artifact gates
  are missing.
- Run the validator red before implementation.
- Run the validator green after implementation.
- Run relevant docs/typecheck/test/build checks.

## Acceptance Criteria

- [x] Private release workflow contract exists.
- [x] Local `validate:release` gate exists.
- [x] `validate:ci` includes the private release pipeline contract check.
- [x] Existing Mac ARM workflow remains contract-validated.
- [x] Worklog is complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T070-private-ci-cd-release-pipeline.md`
