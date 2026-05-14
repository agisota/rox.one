# T482 - Transform data CircleCI EBADF retry

Status: READY FOR HOSTED CI
Phase: CI validation repair
Ticket: docs/tickets/T482-transform-data-circleci-ebadf-retry.md

## 1. Task summary

Harden transform-data subprocess startup against the repeated hosted CircleCI
`EBADF: bad file descriptor, epoll_ctl` spawn failure seen in PR #218 validate
builds 149 and 153.

## 2. Repo context discovered

CircleCI validate build 153 failed on PR #218 head `5afe7910` in
`packages/session-tools-core/src/handlers/transform-data.test.ts`. The uploaded
`validation-logs/test-units.log` shows `EBADF` from `spawn(node, ...)` at
`packages/session-tools-core/src/handlers/transform-data.ts:59`, with
`spawnargs` pointing at the valid descendant output test.

After the first retry-budget hardening commit, CircleCI validate build 156
reproduced the same failure on PR #218 head `37bea54c`. The failure still
reported the raw `EBADF: bad file descriptor, epoll_ctl` at the `spawn(...)`
site and completed the failing test in 8ms, indicating the hosted
pipe-backed stdio setup path was still exposed rather than another long retry
budget exhaustion.

The same PR head passed locally with:

- Direct transform-data test: 8 pass, 0 fail.
- Isolated-neighbor transform-data sequence: 9 pass, 0 fail.
- 50 direct transform-data stress iterations.
- `bun run test:units`: regular suite 6918 pass, 13 skip, 0 fail, plus all
  discovered `.isolated.ts` files green.

The current retry seam already treats `EBADF`, `EMFILE`, and `ENFILE` as
transient startup failures, but CircleCI still reports failure after the current
small retry budget.

The first production build attempt in the `/tmp` PR checkout reached the
resource-copy stage and failed with `ENOSPC` because `/tmp` is a 7.7G tmpfs.
A second attempt using a temporary symlink to main's `node_modules` completed,
but it was discarded as invalid evidence because Vite resolved workspace
packages through `/home/dev/craft/rox-one-terminal`. The final validation was
rerun from `/home/dev/craft/rox-one-terminal-pr218-verify` with a normal
checkout-local `node_modules`; workspace links resolve back into that checkout.

## 3. Files inspected

- `docs/tickets/T474-shiki-singleton-test-timeout.md`
- `docs/worklog/T474-shiki-singleton-test-timeout.md`
- `packages/session-tools-core/src/handlers/transform-data.ts`
- `packages/session-tools-core/src/handlers/transform-data.test.ts`
- `packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `.circleci/config.yml`
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- CircleCI validate builds 149, 153, and 156 artifact `validation-logs/test-units.log`

## 4. Tests added first

Extended
`packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
so a burst of three transient `EBADF` startup failures must still succeed on a
later attempt. Added a companion non-transient guard so an `EACCES` startup
failure still fails closed without retrying.

After build 156, extended the isolated retry file again so transform-data must
not depend on child-process pipe stdio to capture successful output.

## 5. Expected failing test output

The first RED run failed for the intended reason before increasing the retry
budget:

```text
(pass) transform_data transient spawn retry > retries a transient EBADF spawn startup failure and writes output
error: expect(received).toBe(expected)

Expected: false
Received: true

(fail) transform_data transient spawn retry > retries a short transient EBADF burst and writes output
```

The second RED run failed for the intended reason before moving stdout/stderr
capture off child-process pipes:

```text
Expected: false
Received: true

(fail) transform_data transient spawn retry > does not depend on child-process pipe stdio for hosted Bun startup
```

## 6. Implementation changes

- Increased transform-data transient spawn startup retry attempts from 3 to 6.
- Increased the per-attempt retry delay from 25ms to 50ms.
- Kept the retry allowlist limited to `EBADF`, `EMFILE`, and `ENFILE`.
- Moved transform-data stdout/stderr capture from child-process pipes to
  temporary file-backed descriptors under the session data directory.
- Kept path containment and output verification unchanged.

## 7. Validation commands run

- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun test packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `bun run validate:docs`
- `git diff --check origin/main...HEAD && git diff --check`
- `bun run typecheck`
- `bun run typecheck:all`
- `bun run lint`
- `bun run test:units`
- `bun run build`

## 8. Passing test output summary

The isolated retry contract passed after the implementation: 4 pass, 0 fail, 13
expect calls. The burst test reached `spawnCalls === 4`; the file-backed stdio
guard reached `spawnCalls === 1`; the non-transient guard stayed at
`spawnCalls === 1`.

The direct transform-data path containment contract passed: 8 pass, 0 fail, 16
expect calls.

The workspace-scope C4 timeout follow-up is tracked separately under T483; the
complete workspace-scope file passed locally with 54 pass, 0 fail, 54 expect
calls.

Docs validation passed with 450 tickets and 7 required docs. Whitespace checks
passed for both `origin/main...HEAD` and the working-tree diff. `bun run
typecheck` and `bun run typecheck:all` passed. `bun run lint` passed with 7
existing warnings and 0 errors.

The CircleCI-equivalent local unit gate passed from the valid `/home` checkout:
the regular suite reported 6918 pass, 13 skip, 0 fail, 1 snapshot, and 27593
expect calls across 566 files; the discovered isolated suites passed, including
the updated transform-data isolated retry file with 4 pass, 0 fail.

## 9. Build output summary

`bun run build` passed from the valid `/home` checkout. The renderer build used
local checkout paths (`packages/shared/src/highlight/highlighter.ts`), produced
5660 transformed modules, completed Electron main/preload/renderer/resources
stages, verified the 236.3 MB SDK native binary copy, and copied Electron assets.

## 10. Remaining risks

Hosted GitHub macOS ARM64 package is still expected to fail before steps due to
the repository billing/spending-limit condition. Hosted repo-controlled PR #218
checks still need a fresh run after this commit is pushed. R.11 remains blocked
and is not complete.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED demonstrates three transient `EBADF` startup failures exceed the old retry budget | PASS | New burst test failed with `Expected: false / Received: true` before implementation |
| RED demonstrates pipe-backed stdio dependency still exposes hosted `EBADF` startup failure | PASS | New pipe-stdio guard failed with `Expected: false / Received: true` before implementation |
| Transform-data retries enough for the CircleCI EBADF burst while still failing closed for non-transient spawn errors | PASS | Isolated retry test passed with burst `spawnCalls === 4` and non-transient `spawnCalls === 1` |
| Transform-data no longer uses child-process pipe stdio for stdout/stderr capture | PASS | Isolated retry test passed with pipe-stdio guard `spawnCalls === 1` |
| Direct transform-data path containment tests pass | PASS | 8 pass, 0 fail, 16 expect calls |
| CircleCI-equivalent local `bun run test:units` passes | PASS | 6918 pass, 13 skip, 0 fail; isolated suites green |
| Fresh PR #218 hosted repo-controlled checks pass, excluding known GitHub macOS ARM64 billing/spending-limit failure | PENDING | Pending hosted CI rerun after branch push |
| No destructive R.11 action is performed | PASS | No destructive R.11 command has been run in this T482 slice |
