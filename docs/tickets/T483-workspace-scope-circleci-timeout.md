# T483 - Workspace scope CircleCI timeout stabilization

Status: READY FOR HOSTED CI

## Context

PR #218 CircleCI validate build 156 failed
`workspace.ts scope wiring (C4) > theme.GET_ALL_WORKSPACE_THEMES rejects
multi-tenant workspace forgery` after Bun's default 5000ms per-test timeout.

The workspace-scope C4 harness intentionally runs each operation in a fresh
`bun run` child process so module-level multi-tenant runtime state stays
isolated. That makes the file sensitive to hosted process-spawn contention even
when the handler behavior is correct.

## Goal

Keep the C4 workspace scope wiring assertions unchanged while giving the
child-process-heavy test file enough timeout budget to survive hosted CI
contention.

## Required UI

None.

## Required Data/API

No data model or API changes.

## Required Automations

None.

## Required Subagents

Read-only test-engineer analysis confirmed the failing case is deterministic in
handler behavior and the timeout risk is in the test harness spawning many Bun
runner processes.

## TDD Requirements

- Treat CircleCI validate build 156's uploaded `validation-logs/test-units.log`
  timeout as the RED evidence.
- Do not weaken or skip any C4 workspace-scope assertion.

## Implementation Requirements

- Apply a test-only stabilization.
- Keep every workspace-scope scenario and expectation intact.
- Do not modify C4 runtime storage code.
- Do not perform destructive R.11 operations.

## Validation Commands

- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun run test:units`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check origin/main...HEAD`
- `git diff --check`

## Acceptance Criteria

- [x] Hosted RED evidence identifies a C4 workspace-scope test timeout rather
  than an assertion failure.
- [x] Workspace-scope test timeout budget is explicit and test-only.
- [x] The complete workspace-scope file passes locally without skipped cases.
- [ ] Fresh PR #218 hosted repo-controlled checks pass, excluding the known
  GitHub macOS ARM64 billing/spending-limit failure.
- [x] No destructive R.11 action is performed.
