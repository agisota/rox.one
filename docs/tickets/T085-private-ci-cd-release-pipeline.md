# T085 - Private CI/CD Release Pipeline

Status: DONE

## Goal

Confirm and document the private GitHub release validation path for the ROX ONE
production-ready RC branch.

## Scope

- Reuse the existing T070 private release workflow contract where it already
  satisfies the RC requirement.
- Verify local parity scripts:
  - `validate:ci`
  - `validate:release`
  - `validate:private-release-pipeline`
  - `validate:mac-arm-build-workflow`
- Confirm private artifact upload remains workflow-only and does not expose
  public artifacts or secrets.
- Do not add secrets, public upload destinations, generated artifacts, or
  runtime logs.

## Acceptance Criteria

- [x] Private CI path is present and contract-validated.
- [x] Local validation commands exist.
- [x] Mac ARM build workflow is contract-validated.
- [x] Release docs explain the private release path or the T085 worklog points
  to the current release contract.
- [x] Fresh validation evidence is recorded.
- [x] Worklog complete.
- [x] Scoped Lore commit created.
