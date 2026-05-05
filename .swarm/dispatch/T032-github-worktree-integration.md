# Dispatch Packet - T032 GitHub Worktree Integration

## Phase

Wave 1 / Git-worktree control surface.

## Objective

Create deterministic Git/worktree inventory and safety helpers so future workers can run in bounded worktrees, commit scoped files, and push only to the private ROX ONE remote.

## Write Scope

Allowed:

- `docs/tickets/T032-github-worktree-integration.md`
- `docs/worklog/T032-github-worktree-integration.md`
- `packages/shared/src/workbench/*git*`
- `packages/shared/src/workbench/*worktree*`
- `packages/shared/src/workbench/__tests__/*git*`
- `packages/shared/src/workbench/__tests__/*worktree*`
- `scripts/*git*`
- `scripts/*worktree*`

Forbidden without supervisor handoff:

- `apps/electron/src/renderer/**`
- `apps/electron/src/main/**`
- `.github/workflows/**`
- `package.json`
- lockfiles
- real worktree deletion/pruning
- force-push or remote mutation

## Read Scope

- `git worktree list --porcelain`
- `git status --short --branch`
- `git remote -v`
- `docs/tickets/README.md`
- `docs/worklog/README.md`
- existing workbench shared modules and tests

## Test-First Gate

T032 cannot enter implementation until the red tests/checks exist and fail for the expected reason.

Required red tests:

1. Parse `git worktree list --porcelain` into typed entries.
2. Classify entries as `clean`, `dirty`, `prunable`, `merged`, `unmerged`, `missing-upstream`.
3. Reject push when `origin` is not `agisota/rox-one-terminal` or not private.
4. Reject force-push unless an explicit destructive approval artifact is present.
5. Reject staging paths outside the worker allowlist.

Expected initial failure:

- module/helper import missing, or policy function returns permissive defaults before implementation.

## Implementation Constraints

- Use deterministic fixtures, not live Git mutation, for unit tests.
- Command runner adapters must be injectable/fakeable.
- Prune and push helpers may produce commands/recommendations, but must not execute destructive actions in tests.
- Do not broaden scope into GitHub Actions or CI until the parser/policy layer is green.

## Validation Commands

- `bun test packages/shared/src/workbench/__tests__/*worktree*.test.ts`
- `bun test packages/shared/src/workbench/__tests__/*git*.test.ts`
- `bun run validate:agent-contract`
- `git diff --check`
- `git status --short --branch`

If TypeScript files are added under shared:

- `bun run typecheck:shared`
- `bun run lint:shared`

## Worker Output Required

- files inspected
- red output summary
- implementation summary
- validation command outputs
- changed files
- policy evidence for private origin/no-force/staging allowlist
- worklog acceptance matrix
- scoped commit hash

## Promotion Gate

Supervisor may promote T032 only when:

- targeted tests pass
- `validate:agent-contract` passes
- `git diff --check` passes
- worklog is complete
- no real worktree was pruned
- no force-push command was executed
