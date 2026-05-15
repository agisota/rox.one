# T492 - OAuth E2E timeout budget

Status: DONE
Phase: test stability
Ticket: docs/tickets/T492-oauth-e2e-timeout-budget.md

## 1. Task summary

Stabilize the live OAuth metadata E2E test in CI by giving CI's Bun test
invocation an explicit timeout budget.

## 2. Repo context discovered

GitHub Actions `validate` for PR #226 failed in `bun run test:units` with:

```text
(fail) E2E: OAuth Metadata Discovery > GitHub MCP (api.githubcopilot.com) > discovers OAuth metadata [5003.95ms]
^ this test timed out after 5000ms.
```

A local targeted run reproduced the same failure once. Later local reruns
passed, but the GitHub MCP case took 4368.92 ms and then 12278.76 ms after a
longer timeout budget was applied, proving the endpoint can exceed Bun's
default 5000 ms test timeout. The production helper uses its own 5000 ms fetch
timeout per request and already treats unavailable metadata as `null`, so CI's
test timeout must be larger than the network tail.

## 3. Files inspected

- `packages/shared/src/auth/__tests__/oauth.e2e.test.ts`
- `packages/shared/src/auth/oauth.ts`
- `.github/workflows/validate.yml`
- `.circleci/config.yml`
- `docs/worklog/T483-workspace-scope-circleci-timeout.md`
- `docs/worklog/T484-composition-root-full-suite-timeout.md`
- `docs/worklog/T487-mode-manager-ci-timeout.md`

## 4. Tests added first

No new test was added. The existing targeted test was the RED signal:

```bash
bun test packages/shared/src/auth/__tests__/oauth.e2e.test.ts
```

It timed out on the GitHub MCP metadata discovery case before the fix.

## 5. Expected failing test output

```text
(fail) E2E: OAuth Metadata Discovery > GitHub MCP (api.githubcopilot.com) > discovers OAuth metadata [5000.90ms]
^ this test timed out after 5000ms.
```

## 6. Implementation changes

- Updated GitHub Actions validate workflow to run `bun test --timeout=30000`
  and isolated tests with the same timeout.
- Updated CircleCI validate workflow to run `bun test --timeout=30000` and
  isolated tests with the same timeout.
- Left production OAuth discovery unchanged.
- Left package test files unchanged so this PR does not trigger the GitHub
  macOS ARM package workflow path filter.

## 7. Validation commands run

- `bun test packages/shared/src/auth/__tests__/oauth.e2e.test.ts`
- `bun test --timeout=30000 packages/shared/src/auth/__tests__/oauth.e2e.test.ts`
- `bun run validate:docs`
- `bun run validate:ci-contract`
- `bun run validate:rebrand`
- `git diff --check`

## 8. Passing test output summary

Targeted local rerun with the CI timeout budget:

```text
7 pass
0 fail
11 expect() calls
Ran 7 tests across 1 file.
```

Report-only validators:

```text
bun run validate:docs
bun run validate:ci-contract
bun run validate:rebrand
git diff --check
```

## 9. Build output summary

No build is required. This is a CI-only timeout-budget change.

## 10. Remaining risks

The test still depends on live third-party endpoints. The assertions remain
network-tolerant, but endpoint latency can still make the file slower than pure
unit tests.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED timeout evidence exists | PASS | Local and CI showed the GitHub MCP case timing out at about 5000 ms |
| Production OAuth and package test code unchanged | PASS | CI/docs-only change after reverting the package test-file touch |
| Explicit timeout budget added | PASS | GitHub Actions and CircleCI validate jobs run `bun test --timeout=30000` |
| Targeted OAuth E2E passes with CI budget | PASS | `bun test --timeout=30000 packages/shared/src/auth/__tests__/oauth.e2e.test.ts` |
| Validators pass | PASS | `validate:docs`, `validate:ci-contract`, `validate:rebrand`, `git diff --check` |
