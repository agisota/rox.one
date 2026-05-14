# T482 - Transform data CircleCI EBADF retry

Status: DONE

## Context

PR #218 fresh CircleCI validate builds 149 and 153 both failed the same
`transform_data path containment > allows valid descendant paths and writes
output` unit. The hosted artifact shows `EBADF: bad file descriptor, epoll_ctl`
from `spawn(node, ...)` during transform-data subprocess startup.

PR #218 CircleCI validate build 156 reproduced the same hosted failure after
the retry-budget increase. The 8ms failure happened before successful child
stdio pipe setup, so the remaining risk is the hosted Bun/Node pipe-backed
stdio path rather than another retry-count budget issue.

## Goal

Make transform-data subprocess startup tolerate a short burst of transient
`EBADF` spawn startup failures and avoid the hosted `epoll_ctl` pipe-stdio
failure path without weakening path containment or changing successful transform
behavior.

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
- Extend the isolated test so transform-data must not depend on child-process
  pipe stdio to capture successful script output.
- Confirm the new test fails before increasing the retry budget.

## Implementation Requirements

- Keep production path containment behavior unchanged.
- Keep transient retry limited to explicit spawn startup errors
  (`EBADF`, `EMFILE`, `ENFILE`).
- Preserve stdout/stderr capture for successful and failing scripts.
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
- [x] RED demonstrates pipe-backed stdio dependency still exposes hosted
  `EBADF` startup failure.
- [x] Transform-data retries enough for the CircleCI EBADF burst while still
  failing closed for non-transient spawn errors.
- [x] Transform-data no longer uses child-process pipe stdio for stdout/stderr
  capture.
- [x] Direct transform-data path containment tests pass.
- [x] CircleCI-equivalent local `bun run test:units` passes.
- [x] Fresh PR #218 hosted repo-controlled checks pass, excluding the known
  GitHub macOS ARM64 billing/spending-limit failure.
- [x] No destructive R.11 action is performed.
