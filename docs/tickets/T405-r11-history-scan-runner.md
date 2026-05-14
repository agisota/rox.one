# T405 - R.11 history scan runner

Status: DONE

## Context

The rebrand goal's final global gate says `git log -p --all` must show zero
forbidden-token matches outside the legal-preserve allowlist. T404 made that
requirement explicit in T298, but the gate is still manual.

## Goal

Add a report-only R.11 history-scan runner that streams `git log -p --all` and
fails when forbidden legacy-token patch lines appear outside the legal-preserve
path allowlist.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Add a package script for the runner. The runner must be read-only: no ref
mutation, no backup creation, no branch deletion, no `git filter-repo`, no
force-push, and no `update_goal`.

## Required Subagents

None. This is bounded to a script, tests, ticket, and worklog.

## TDD Requirements

Add failing unit tests first for the diff parser and allowlist behavior. Confirm
the tests fail before implementation.

## Implementation Requirements

- Export pure parser/evaluator helpers for unit tests.
- Track current commit and diff path while scanning `git log -p --all` output.
- Ignore legal-preserve paths such as `LICENSE`, `NOTICE`, `TRADEMARK.md`,
  `Dockerfile.server`, historical decision records, tickets/worklogs, release
  notes, `.brv/`, `.swarm/`, and `.git/`.
- Record non-allowlisted forbidden-token findings with commit, path, token, and
  line evidence.
- Stop printing after a bounded finding count while still making the failure
  explicit.
- Wire the script as `bun run rebrand:r11-history-scan`.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-history-scan.test.ts`
- `bun run rebrand:r11-history-scan` (expected red before R.11 rewrite)
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED unit tests fail before implementation.
- [x] Parser records forbidden-token findings outside the history allowlist.
- [x] Parser ignores legal-preserve paths.
- [x] CLI exits non-zero on current history and prints bounded findings.
- [x] Package script `rebrand:r11-history-scan` exists.
- [x] Runner remains report-only.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T405-r11-history-scan-runner.md`.
