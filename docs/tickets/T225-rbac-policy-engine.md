# T225 - RBAC policy engine

## Context

We are building a white-label fork of Craft Agents OSS into Agent Workbench Suite.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

T224 introduced the RBAC types. T225 lands the **pure-function** policy
evaluator that the rest of M.2 calls. The engine receives `(grants, action,
resource)` and returns `{allow, reason}`. It must be deterministic and
exhaustively tested so downstream tickets can rely on it without re-deriving
the access matrix.

The engine is also the production-shaped replacement for the C.4 "always
permit" stub currently in
`packages/server-core/src/handlers/rpc/account-ownership.ts`, but T225 does
**not** wire it in yet. That swap lands in T226.

## Goal

Provide a pure-function `evaluate(grants, action, resource)` and a
`permittedWorkspaces(grants)` helper that downstream tickets can adopt
without further design work.

## Required UI

None.

## Required Data/API

- `evaluate(grants, action, resource) -> {allow, reason}`.
- `permittedWorkspaces(grants) -> ReadonlyArray<string>` returning the set of
  workspace ids the actor can `read`, with a global sentinel
  (`PERMITTED_WORKSPACES_GLOBAL_SENTINEL = '*'`) when any grant is a
  global-scope read.
- No persistence, no I/O, no environment reads.

## Required Automations

None.

## Required Subagents

None. T224 already established the schema layout. The engine consumes that
schema and exposes new functions in the same package.

## TDD Requirements

Before implementation:

1. Write unit tests in `packages/shared/src/auth/__tests__/policy-engine.test.ts`
   covering: return shape (never throws, always `{allow, reason}`), each
   system role's action set, scope isolation across workspaces, global scope,
   union of grants, `permittedWorkspaces` behavior including the global
   sentinel, and purity guarantees (idempotence, no input mutation, no env
   reads).
2. Run the tests and confirm they fail because the module does not yet exist.
3. Implement the minimum module needed to make them pass.

## Implementation Requirements

- Add `packages/shared/src/auth/policy-engine.ts` exporting `evaluate`,
  `permittedWorkspaces`, `PolicyDecision`, `PolicyResource`, and
  `PERMITTED_WORKSPACES_GLOBAL_SENTINEL`.
- Engine logic:
  - `owner` grants `read`, `write`, `admin`.
  - `editor` grants `read`, `write`.
  - `viewer` grants `read`.
  - A global-scope grant applies to every resource scope.
  - A workspace-scope grant only applies to its own `scopeId`.
  - Union of grants: any grant that permits the action returns allow.
  - No grants → `{allow: false, reason: 'no-grant'}`.
  - Grants present but none cover the action × resource →
    `{allow: false, reason: 'no-matching-scope'}`.
- Wire the new module into `packages/shared/src/auth/index.ts` and add a
  subpath export entry in `packages/shared/package.json`.
- No edits to `account-ownership.ts`, `AccountStore.ts`, or any RPC handler.

## Validation Commands

- `bun test packages/shared/src/auth/__tests__/policy-engine.test.ts`
- `bun run validate:rebrand` must still exit 0
- `git diff --check`

## Acceptance Criteria

- [x] `evaluate` returns `{allow, reason}` and never throws.
- [x] System roles allow exactly the documented action sets.
- [x] Scope isolation is enforced (workspace W1 grant does not cover W2).
- [x] Global-scope grants cover every resource scope.
- [x] Union of grants applies (any allowing grant wins).
- [x] `permittedWorkspaces` returns the deduplicated set of readable workspace
      ids, or the single-entry `['*']` sentinel for global readers.
- [x] Pure: same inputs → same outputs, no input mutation, no env reads.
- [x] Unit tests pass.
- [x] `validate:rebrand` exits 0.
- [x] Worklog complete.
- [x] Commit created.

## Out of scope for this cycle

T226, T227, T228, T229, and T230 are explicitly deferred to subsequent cycles.
The engine is implemented and tested; wiring it into
`deriveScopeFromAuth`, persisting grants, exposing admin RPC, building the
admin UI, and writing the ADR ship later. This ticket does **not** edit
`packages/server-core/src/handlers/rpc/account-ownership.ts` or
`packages/server-core/src/accounts/AccountStore.ts`.

## Worklog

Update `docs/worklog/T225-rbac-policy-engine.md`.
