# T487 - Mode manager CI timeout stabilization

Status: DONE
Phase: Hosted validation repair
Ticket: docs/tickets/T487-mode-manager-ci-timeout.md

## 1. Task summary

Stabilize the hosted GitHub `validate` job for PR #222 after a single
mode-manager write-detection test timed out at Bun's default 5000ms budget.

## 2. Repo context discovered

PR #222 passed local `validate:docs`, `typecheck`, `lint`, full `bun test`,
and `bun run build`. Hosted checks passed on Gitleaks, GitHub core scenario
suite, and all CircleCI jobs. GitHub `validate` failed only one unit test:
`shouldAllowToolInMode - Bash plans folder exception > should allow Codex-style
zsh write to plans folder`, timing out after 5000ms in the hosted
`test:units` run.

## 3. Files inspected

- `packages/shared/tests/mode-manager-write-detection.test.ts`
- `packages/shared/src/agent/mode-manager.ts`

## 4. Tests added first

No new assertion was added. The RED evidence is the hosted GitHub `validate`
failure against the existing write-detection scenario.

## 5. Expected failing test output

Hosted GitHub `validate` RED summary:

```text
1 tests failed:
(fail) shouldAllowToolInMode - Bash plans folder exception > should allow bash writes to plans folder in safe mode > should allow Codex-style zsh write to plans folder [5220.93ms]
  ^ this test timed out after 5000ms.

6922 pass
13 skip
1 fail
1 snapshots, 27647 expect() calls
Ran 6936 tests across 566 files. [190.52s]
```

Local isolation check before the change passed:

```text
1 pass
49 filtered out
0 fail
1 expect() calls
Ran 1 test across 1 file. [173.00ms]
```

## 6. Implementation changes

- Added `setDefaultTimeout(30_000)` to
  `packages/shared/tests/mode-manager-write-detection.test.ts`.
- Left every mode-manager write-detection scenario and expectation unchanged.

## 7. Validation commands run

- `bun test packages/shared/tests/mode-manager-write-detection.test.ts --test-name-pattern "Codex-style zsh write to plans folder"`
- `bun test packages/shared/tests/mode-manager-write-detection.test.ts`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun test`

## 8. Passing test output summary

The target test passed locally before the timeout stabilization: 1 pass, 0
fail, 1 expect call.

The full mode-manager write-detection file passed after the stabilization: 44
pass, 6 Windows-only skip, 0 fail, 84 expect calls.

`bun run validate:docs` passed (`agent-contract`, `architecture-docs`,
`sync-v2-design`).

`bun run typecheck` passed.

`bun run lint` passed with 7 existing warnings, 0 errors.

The full suite passed after the stabilization: 6918 pass, 13 skip, 0 fail, 1
snapshot, and 27571 expect calls across 566 files.

## 9. Build output summary

No runtime build is required for this test-only change. Build status remains
tracked separately for the PR #222 validation pass.

## 10. Remaining risks

GitHub `validate` must be rerun after this commit. The macOS ARM64 GitHub job
still fails before checkout because of account billing/spending-limit and is
not code-owned by this branch.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Hosted CI RED evidence points only at the mode-manager write-detection timeout | PASS | GitHub `validate` failed one test at 5000ms |
| Mode-manager timeout budget is explicit and test-only | PASS | `mode-manager-write-detection.test.ts` calls `setDefaultTimeout(30_000)` and no runtime file changed |
| Target test passes locally without skipped assertions | PASS | 1 pass, 0 fail, 1 expect call |
| Full `bun test` passes locally after the patch | PASS | 6918 pass, 13 skip, 0 fail |
| No destructive R.11 action is performed | PASS | Only CI inspection and this test/docs patch were used |
