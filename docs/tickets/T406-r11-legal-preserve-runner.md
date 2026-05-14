# T406 - R.11 legal preserve runner

Status: DONE

## Context

The R.11 goal requires legal-preserve checks after `git filter-repo` and before
any force-push:

- `LICENSE`, `NOTICE`, and `TRADEMARK.md` must be byte-identical to the
  `pre-rebrand-history-rewrite-backup` versions.
- `Dockerfile.server` must still carry the upstream source attribution URL.

Those checks are currently manual shell snippets in the goal file.

## Goal

Add a report-only R.11 legal-preserve runner that executes those checks without
mutating refs or history.

## Required UI

None.

## Required Data/API

No product data or runtime API changes.

## Required Automations

Add a package script for the runner. It must be read-only: no ref mutation, no
backup creation, no branch deletion, no `git filter-repo`, no force-push, and
no `update_goal`.

## Required Subagents

None. This is bounded to a script, tests, ticket, and worklog.

## TDD Requirements

Add failing unit tests first for byte-diff pass/fail, missing backup content,
and Dockerfile attribution failure.

## Implementation Requirements

- Export pure evaluator/formatter helpers for unit tests.
- Compare `LICENSE`, `NOTICE`, and `TRADEMARK.md` backup-vs-HEAD content.
- Fail closed when backup content is missing.
- Fail closed when the Dockerfile source label no longer points at the upstream
  attribution repository.
- Wire the script as `bun run rebrand:r11-legal-preserve`.
- Keep the runner report-only.

## Validation Commands

- `bun test scripts/__tests__/rebrand-r11-legal-preserve.test.ts`
- `bun run rebrand:r11-legal-preserve` (expected red until the backup tag exists)
- `bun run typecheck`
- `bun run lint`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED unit tests fail before implementation.
- [x] Evaluator passes when attribution files match and Dockerfile attribution is intact.
- [x] Evaluator fails on attribution-file drift.
- [x] Evaluator fails on missing backup content.
- [x] Evaluator fails on Dockerfile attribution loss.
- [x] Package script `rebrand:r11-legal-preserve` exists.
- [x] Runner remains report-only.
- [x] Relevant validation passes.
- [x] Commit created.

## Worklog

See `docs/worklog/T406-r11-legal-preserve-runner.md`.
