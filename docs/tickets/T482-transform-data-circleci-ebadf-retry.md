# T482 - Transform data CircleCI EBADF retry

Status: READY FOR HOSTED CI

## Context

PR #218 fresh CircleCI validate builds 149 and 153 both failed the same
`transform_data path containment > allows valid descendant paths and writes
output` unit. The hosted artifact shows `EBADF: bad file descriptor, epoll_ctl`
from `spawn(node, ...)` during transform-data subprocess startup.

The local PR worktree passes the direct transform-data test, the isolated
spawn-retry neighbor sequence, a 50-iteration direct-file stress loop, and the
CircleCI-equivalent `bun run test:units`, so the failure is a hosted Linux
resource/startup flake that still exceeds the current retry budget.

## Goal

Make transform-data subprocess startup tolerate a short burst of transient
`EBADF` spawn startup failures without weakening path containment or changing
successful transform behavior.

## Required UI

None.

## Required Data/API

No data model or API changes.

## Required Automations

None.

## Required Subagents

None required; failure evidence is already isolated to the existing
transform-data retry seam.

## TDD Requirements

- Extend the existing isolated spawn retry test first so three transient
  `EBADF` startup failures must still succeed on a later attempt.
- Confirm the new test fails before increasing the retry budget.

## Implementation Requirements

- Keep production path containment behavior unchanged.
- Keep transient retry limited to explicit spawn startup errors
  (`EBADF`, `EMFILE`, `ENFILE`).
- Do not add dependencies.
- Do not perform destructive R.11 operations.

## Validation Commands

- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun run test:units`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check origin/main...HEAD`
- `git diff --check`

## Acceptance Criteria

- [x] RED demonstrates three transient `EBADF` startup failures exceed the old
  retry budget.
- [x] Transform-data retries enough for the CircleCI EBADF burst while still
  failing closed for non-transient spawn errors.
- [x] Direct transform-data path containment tests pass.
- [x] CircleCI-equivalent local `bun run test:units` passes.
- [ ] Fresh PR #218 hosted repo-controlled checks pass, excluding the known
  GitHub macOS ARM64 billing/spending-limit failure.
- [x] No destructive R.11 action is performed.
