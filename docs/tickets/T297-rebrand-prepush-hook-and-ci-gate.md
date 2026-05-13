# T297 - Rebrand prepush hook and CI gate (R.10 enforcement)

Status: DONE

## Context

We are building a white-label fork of Craft Agents OSS into
ROX.ONE Agent Workbench Suite.

Phase R.10 of the ROX.ONE rebrand sweep
(`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`,
"Phase R.10 — Final sweep + closeout" item 6: *Add `bun run
validate:rebrand` to the prepush git hook and the CI matrix so any
future regression fails closed*).

R.9.5 made `bun run validate:rebrand` exit 0. T297 makes that
permanent: any future change that reintroduces a forbidden legacy
token outside the allowlist fails the local pre-push hook AND the
GitHub Actions Validate workflow.

T296 is the sibling closeout ticket in the same R.10 commit set.

## Goal

1. Land a TDD regression test
   `scripts/__tests__/rebrand-permanent-gate.test.ts` that asserts:
   - `.husky/pre-push` exists with executable mode bits set.
   - The hook contents include the literal string
     `bun run validate:rebrand`.
   - At least one `.github/workflows/*.yml` file contains a step that
     runs `bun run validate:rebrand`.
2. Create `.husky/pre-push` as a tracked file with husky v9.1
   user-shim conventions (plain shell script — no `#!/usr/bin/env sh`
   source-line dance, no deprecated `_/husky.sh` import) and the
   executable mode bit set.
3. Add a `validate:rebrand gate` step to `.github/workflows/validate.yml`
   that runs `bun run validate:rebrand` and tees its output to
   `.ci-logs/validate-rebrand.log`. The step is placed before
   `Run validation suite` so a rebrand regression fails fast.

## Required UI

None.

## Required Data/API

None. Build-time enforcement only.

## Required Automations

Two new automations:

- **Local enforcement**: `.husky/pre-push` runs `bun run validate:rebrand`
  on every `git push`. Husky 9.1.7 is already configured in
  `package.json` (`"prepare": "husky"`), so `bun install` provisions the
  `.husky/_/` dispatcher set automatically.
- **CI enforcement**: `.github/workflows/validate.yml` gains a
  `validate:rebrand gate (R.10 permanent)` step.

## Required Subagents

None — single-file edits in three locations with deterministic
outcomes captured by the regression test.

## TDD Requirements

`scripts/__tests__/rebrand-permanent-gate.test.ts` asserts four
properties:

1. `.husky/pre-push` exists.
2. `.husky/pre-push` has owner-execute mode bit (`0o100`) set.
3. `.husky/pre-push` contents include the literal
   `bun run validate:rebrand`.
4. At least one file under `.github/workflows/*.yml` contains the
   literal `bun run validate:rebrand`.

Red output captured before the hook + CI step land: 4 fail, 0 pass.
Green output after: 4 pass, 0 fail (recorded in
`docs/worklog/T297-rebrand-prepush-hook-and-ci-gate.md` §5 and §8).

## Implementation Requirements

### Husky v9 user-shim layout

Husky 9.1.7 (installed via `"prepare": "husky"`) sets
`core.hooksPath = .husky/_/` at install time. The `_/` dispatcher
files are gitignored (`.husky/_/.gitignore = *`); the user-shim files
live at `.husky/<hookname>` as tracked sources. The dispatcher
script `.husky/_/h` resolves the hook target by
`s=$(dirname "$(dirname "$0")")/$n` → `.husky/<hookname>` and
executes it via `sh -e "$s" "$@"`.

The deprecated v8 form (`#!/usr/bin/env sh` + `.
"$(dirname -- "$0")/_/husky.sh"`) emits a deprecation warning in v9.1
and will fail in v10. T297 uses the forward-compatible plain-shell
form (commands only, no source line).

### CI step placement

`.github/workflows/validate.yml` already has a `Prepare validation
logs` step and a `Run validation suite` step that runs
`validate:agent-contract`, `validate:architecture-docs`, `validate:ci`,
and `test:units`. The `validate:rebrand gate (R.10 permanent)` step
is inserted between the two so a rebrand regression fails fast (before
the heavier validation suite runs).

## Validation Commands

- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` — the
  new R.10 regression test.
- `bun run validate:rebrand` — MUST exit 0 (the gate itself).
- `bun test scripts/__tests__/community-link-audit.test.ts`
- `bun test scripts/__tests__/rebrand-surface-text.test.ts`
- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] `.husky/pre-push` exists, executable, with husky v9 user-shim
      contents and the literal `bun run validate:rebrand` command.
- [x] `.github/workflows/validate.yml` carries the
      `validate:rebrand gate (R.10 permanent)` step.
- [x] `scripts/__tests__/rebrand-permanent-gate.test.ts` is green
      (4 pass, 0 fail).
- [x] `bun run validate:rebrand` exits 0 in the worktree.
- [x] R.0–R.9.5 sibling regression tests stay green.
- [x] Hook contents are forward-compatible with husky v10 (no
      deprecated `_/husky.sh` source line).

## Worklog

Update `docs/worklog/T297-rebrand-prepush-hook-and-ci-gate.md`.
