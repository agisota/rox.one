# T261 - Rebrand mapping report

Status: DONE

## Context

Phase R.0 requires a post-sweep audit baseline before code and asset renames
begin. The report captures current forbidden-token inventory by bucket and
documents what must be preserved for legal attribution.

## Goal

Create `docs/release/rebrand-mapping-2026-05-13.md` from structured ripgrep
inventory so later phases can reduce each bucket to zero outside the
legal-preserve allowlist.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None for this inventory/report task.

## TDD Requirements

Before implementation:

1. Run a failing file-existence assertion for the mapping report.
2. Confirm the failure proves the report does not yet exist.

## Implementation Requirements

- Create `docs/release/rebrand-mapping-2026-05-13.md`.
- Inventory forbidden product tokens with `rg`.
- Split findings by bucket: package scope, env vars, config paths, product text,
  identifiers, assets/docs/binaries, community links, and legal preserve.
- Link the report back to ADR 0011.

## Validation Commands

- `test -f docs/release/rebrand-mapping-2026-05-13.md`
- `rg -n "## Bucket" docs/release/rebrand-mapping-2026-05-13.md`
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] Mapping report exists.
- [x] Report includes the forbidden-token list.
- [x] Report includes bucketed current inventory.
- [x] Report documents legal-preserve paths.
- [x] Report links to ADR 0011.
- [x] Docs validation passes.
- [x] Whitespace check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T261-rebrand-mapping-report.md`.
