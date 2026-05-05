# T032 - GitHub Worktree Integration

## 1. Task summary

Initial worklog placeholder for the upcoming T032 implementation wave. This file exists so dispatch can start with a matching evidence journal before any feature code is written.

## 2. Repo context discovered

- `origin` points to private repository `https://github.com/agisota/rox-one-terminal.git`.
- `main` is ahead of `origin/main` and must be pushed only after safe gate checks.
- T003-T012 worktree heads are merged into `main`.
- One stale `codex/telegram-ru-polish` worktree is prunable.
- `.swarm/plan.md` now requires T032 to begin with red tests and policy checks before implementation.

## 3. Files inspected

- `docs/tickets/T032-github-worktree-integration.md`
- `.swarm/plan.md`
- `.swarm/inventory.md`

## 4. Tests added first

Pending T032 execution. Required first tests are listed in the ticket and dispatch packet.

## 5. Expected failing test output

Pending T032 execution. The first expected red output should come from missing Git/worktree parser/classifier/policy helpers.

## 6. Implementation changes

Not started. This placeholder was created during T059 planning to satisfy the supervisor dispatch contract.

## 7. Validation commands run

Pending T032 execution.

## 8. Passing test output summary

Pending T032 execution.

## 9. Build output summary

Pending T032 execution if runtime/build surfaces are touched.

## 10. Remaining risks

- Implementation must not mutate or prune real worktrees in tests.
- Push automation must verify private `origin` and block force-push by default.
- Staging must be allowlist-driven to avoid committing unrelated runtime files.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| Matching worklog exists before implementation | DONE | This file |
| Tests added first | PENDING | T032 execution |
| Worktree parser/classifier implemented | PENDING | T032 execution |
| Private origin policy tested | PENDING | T032 execution |
| Force-push blocked by default | PENDING | T032 execution |
| Scoped commit created | PENDING | T032 execution |
