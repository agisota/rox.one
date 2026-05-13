# T262 - Rebrand lint script

Status: DONE

## Context

The rebrand sweep needs an automated forbidden-token gate before edits begin so
every later phase can prove it reduces legacy product branding instead of
reintroducing it.

## Goal

Add `scripts/validate-rebrand.cjs`, wire it as `bun run validate:rebrand`, and
prove it fails on the current inventory while preserving the legal allowlist.

## Required UI

None.

## Required Data/API

None.

## Required Automations

- Root package script: `validate:rebrand`.

## Required Subagents

None for this bounded script task.

## TDD Requirements

Before implementation:

1. Run `bun run validate:rebrand`.
2. Confirm it fails because the package script does not yet exist.

## Implementation Requirements

- Add `scripts/validate-rebrand.cjs`.
- Detect the forbidden tokens from the rebrand goal.
- Respect the legal-preserve allowlist.
- Print actionable path/line/token findings.
- Exit non-zero while forbidden tokens remain outside the allowlist.
- Add the root package script without adding production dependencies.

## Validation Commands

- `bun run validate:rebrand` before implementation, expecting missing script.
- `bun run validate:rebrand` after implementation, expecting a non-zero
  forbidden-token report on the current pre-sweep repo.
- `bun run validate:docs`
- `git diff --check`

## Acceptance Criteria

- [x] `scripts/validate-rebrand.cjs` exists.
- [x] `package.json` exposes `validate:rebrand`.
- [x] The script reports forbidden tokens outside legal-preserve paths.
- [x] The script exits non-zero on the current pre-sweep inventory.
- [x] Legal-preserve files are allowlisted.
- [x] Docs validation passes.
- [x] Whitespace check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T262-rebrand-lint-script.md`.
