# T371 - Rebrand R.11 git-filter-repo PATH bridge

Status: DONE

## Context

R.11 remains blocked by the destructive preflight. One blocker is local tooling:
`git-filter-repo` exists under the user's local bin directory, but that
directory is not on PATH, so `git filter-repo` is unavailable to the R.11
procedure.

## Goal

Make the already-installed `git-filter-repo` executable discoverable from the
current Codex shell without starting R.11 or creating backup refs.

## Required UI

None.

## Required Data/API

No product data or API changes.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Capture the failing tooling check first, then add the PATH bridge and rerun the
R.11 report-only preflight.

## Implementation Requirements

- Do not install a production dependency.
- Do not run `git filter-repo`.
- Do not create backup tags, backup branches, or offline mirrors.
- Do not force-push.
- Keep this as environment preparation only.

## Validation Commands

- `command -v git-filter-repo`
- `git filter-repo --version`
- `bun run rebrand:r11-preflight`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `git diff --check`

## Acceptance Criteria

- [x] RED tooling check captured before the PATH bridge.
- [x] `git-filter-repo` is discoverable on PATH.
- [x] `git filter-repo --version` exits 0.
- [x] R.11 preflight shows the tooling prerequisite passing and remains red on other blockers.
- [x] Documentation validation passes.
- [x] Rebrand validation passes.
- [x] Whitespace diff check passes.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T371-rebrand-r11-git-filter-repo-path.md`.
