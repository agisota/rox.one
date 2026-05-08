# T103 - Runtime Artifact Git Hygiene

Status: DONE

## Context

Release and worklog evidence repeatedly classify `events.jsonl`, `.claude/`,
and `.ouroboros/` as local runtime artifacts. The repo still tracks
`events.jsonl`, so local smoke/dev runs can keep producing tracked dirty diffs
that every production ticket must explicitly avoid staging.

## Goal

Make the runtime-artifact boundary enforceable at the repo level: local runtime
artifacts should be ignored by git, and `events.jsonl` should no longer be part
of the repository index.

## Required UI

No UI change.

## Required Data/API

- Preserve the local `events.jsonl` file on disk for the operator.
- Remove `events.jsonl` from the git index only.
- Ignore `events.jsonl`, `.claude/`, and `.ouroboros/` as local runtime
  artifacts.

## Required Automations

- Add a focused regression test that checks the ignore policy and confirms the
  runtime artifacts are not tracked.

## Required Subagents

No subagent required: this is a narrow repo-hygiene slice.

## TDD Requirements

Before implementation:

1. Add a focused test that fails while `events.jsonl` is still tracked and the
   ignore policy is missing.
2. Run it and capture the expected red result.

## Implementation Requirements

- Do not delete the operator's local runtime artifacts.
- Do not stage `.claude/`, `.ouroboros/`, or local evidence/log directories.
- Keep the change scoped to docs, the regression test, `.gitignore`, and the
  `events.jsonl` index removal.

## Validation Commands

- `bun test scripts/__tests__/runtime-artifact-git-hygiene.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `git status --short --branch --ignored`

## Acceptance Criteria

| Criteria | Status |
|---|---|
| Runtime artifact hygiene test fails before the fix and passes after | DONE |
| `.gitignore` ignores `events.jsonl`, `.claude/`, and `.ouroboros/` | DONE |
| `events.jsonl` is removed from the git index without deleting the local file | DONE |
| Docs validation passes | DONE |
| Worklog complete | DONE |
| Scoped Lore commit exists without unrelated runtime artifacts | DONE |

## Worklog

Update `docs/worklog/T103-runtime-artifact-git-hygiene.md`.
