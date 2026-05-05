# T032 - GitHub Worktree Integration

## 1. Task summary

Implemented the deterministic Git/worktree safety helper layer required before broad worker dispatch.

## 2. Repo context discovered

- `origin` points to private repository `https://github.com/agisota/rox-one-terminal.git`.
- `main` is ahead of `origin/main` and must be pushed only after safe gate checks.
- T003-T012 worktree heads are merged into `main`.
- One stale `codex/telegram-ru-polish` worktree is prunable.
- `.swarm/plan.md` requires T032 to begin with red tests and policy checks before implementation.
- Shared workbench modules are the right location for pure, reusable dispatch policy helpers.

## 3. Files inspected

- `docs/tickets/T032-github-worktree-integration.md`
- `.swarm/plan.md`
- `.swarm/inventory.md`
- `.swarm/dispatch/T032-github-worktree-integration.md`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/__tests__/experience-layer.test.ts`
- `packages/shared/package.json`

## 4. Tests added first

Added before implementation:

- `packages/shared/src/workbench/__tests__/git-worktree-integration.test.ts`

Coverage:

- parse `git worktree list --porcelain`
- classify clean/dirty/prunable/merged/unmerged/missing-upstream entries
- reject wrong or public `origin`
- block force-push by default
- reject staged paths outside allowlist

## 5. Expected failing test output

Initial red command:

```bash
bun test packages/shared/src/workbench/__tests__/git-worktree-integration.test.ts
```

Expected failure:

```text
error: Cannot find module '../git-worktree-integration'
0 pass
1 fail
```

## 6. Implementation changes

- Added `packages/shared/src/workbench/git-worktree-integration.ts`.
- Implemented pure parser for `git worktree list --porcelain`.
- Implemented worktree classification from deterministic context:
  - clean
  - dirty
  - prunable
  - merged/unmerged
  - missing upstream
- Implemented private origin policy validation for `agisota/rox-one-terminal`.
- Implemented no-force default push policy.
- Implemented staging allowlist validation.
- No real Git mutation, pruning, push, or remote mutation was added.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/git-worktree-integration.test.ts` - pass
- `bun run typecheck:shared` - pass
- `bun run lint:shared` - pass

## 8. Passing test output summary

Targeted test result:

```text
5 pass
0 fail
12 expect() calls
```

Shared typecheck and lint passed.

## 9. Build output summary

No build required. T032 changes shared pure helpers and tests only.

## 10. Remaining risks

- This ticket provides pure helpers only; no CLI wrapper or UI surface yet.
- Pruning remains recommendation-only and is not executed by this code.
- Force-push can be allowed only if a destructive approval artifact is explicitly supplied to the pure policy function; supervisor automation must still forbid it unless separately approved.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| Matching worklog exists before implementation | DONE | This file |
| Tests added first | DONE | `git-worktree-integration.test.ts` red before implementation |
| Worktree parser/classifier implemented | DONE | `git-worktree-integration.ts` |
| Private origin policy tested | DONE | targeted test |
| Force-push blocked by default | DONE | targeted test |
| Staging allowlist rejects unrelated files | DONE | targeted test |
| Targeted tests pass | DONE | `5 pass, 0 fail` |
| Shared typecheck passes | DONE | `bun run typecheck:shared` |
| Shared lint passes | DONE | `bun run lint:shared` |
| Scoped commit created | DONE | This T032 Lore commit |
