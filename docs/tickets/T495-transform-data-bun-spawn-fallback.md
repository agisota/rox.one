# T495 - Transform data Bun spawn fallback

Status: DONE

## Context

PR #228 CircleCI `validate` failed in the unit suite on
`transform_data path containment > allows valid descendant paths and writes
output`. The hosted artifact again shows `EBADF: bad file descriptor,
epoll_ctl` from `spawn(node, ...)` inside `transform-data.ts`, despite the
T482 retry and file-backed stdio hardening.

## Goal

Make `transform_data` tolerate hosted Bun/Node compatibility `spawn` EBADF
bursts by falling back to native `Bun.spawn` when the Node `child_process.spawn`
path exhausts transient startup retries.

## Required UI

None.

## Required Data/API

No data model or public API changes.

## Required Automations

None.

## Required Subagents

Use read-only subagents for CI history, PR state, and goal blocker audit while
the leader implements the narrow fix.

## TDD Requirements

- Add failing isolated coverage where every Node `child_process.spawn` attempt
  throws transient `EBADF`, and `transform_data` must still write output through
  the fallback path.
- Keep the non-transient spawn error guard failing closed.

## Implementation Requirements

- Keep path containment behavior unchanged.
- Keep the Node `child_process.spawn` retry path for non-Bun runtimes.
- Use native `Bun.spawn` only when available and only after transient Node
  spawn startup retries are exhausted.
- Do not add dependencies.
- Do not perform destructive R.11 actions.

## Validation Commands

- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun run test:units`
- `bun run build`

## Acceptance Criteria

- [x] RED demonstrates exhausted Node transient `EBADF` startup retries still
  fail before the fallback implementation.
- [x] Transform-data falls back to native `Bun.spawn` after exhausted transient
  Node spawn startup retries.
- [x] Non-transient spawn startup errors still fail closed without fallback.
- [x] Direct transform-data path containment tests pass.
- [x] CircleCI-equivalent local unit gate passes.
- [x] No destructive R.11 action is performed.
