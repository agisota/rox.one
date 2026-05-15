# T495 - Transform data Bun spawn fallback

Status: DONE
Phase: CI validation repair
Ticket: docs/tickets/T495-transform-data-bun-spawn-fallback.md

## 1. Task summary

Repair the PR #228 CircleCI `validate` failure where hosted Bun again surfaced
`EBADF: bad file descriptor, epoll_ctl` from `node:child_process.spawn` during
the successful descendant-path `transform_data` test.

## 2. Repo context discovered

PR #228 is docs-only for the R.11 ref blocker snapshot, but CircleCI validate
job #227 failed in `validation-logs/test-units.log` on the existing
`transform_data path containment > allows valid descendant paths and writes
output` unit. The failure is the same hosted EBADF class handled in T482 and
T486, but it recurred after six Node spawn retry attempts and file-backed stdio
capture.

Local direct checks pass before this fix:

- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `CI=1 bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`

## 3. Files inspected

- `packages/session-tools-core/src/handlers/transform-data.ts`
- `packages/session-tools-core/src/handlers/transform-data.test.ts`
- `packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `docs/tickets/T482-transform-data-circleci-ebadf-retry.md`
- `docs/worklog/T482-transform-data-circleci-ebadf-retry.md`
- `docs/tickets/T486-transform-data-capture-diagnostics.md`
- `docs/worklog/T486-transform-data-capture-diagnostics.md`
- `docs/worklog/T477-circleci-second-round-repairs.md`
- CircleCI PR #228 `validation-logs/test-units.log`

## 4. Tests added first

Added an isolated regression test to
`packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
that forces all six Node `child_process.spawn` attempts to throw transient
`EBADF` and expects the transform to still write the output file through a
fallback path.

## 5. Expected failing test output

The RED run failed for the intended reason before implementation:

```text
Expected: false
Received: true

(fail) transform_data transient spawn retry > falls back after exhausted transient Node spawn EBADF startup failures
```

## 6. Implementation changes

- Added a small typed `Bun.spawn` fallback seam in `transform-data.ts`.
- Kept the existing Node `child_process.spawn` path and its six transient
  retry attempts as the primary path.
- Invoked the native `Bun.spawn` fallback only when the final Node spawn attempt
  fails with one of the existing transient startup codes.
- Reused the existing file-backed stdout/stderr capture, timeout handling, and
  capture-read diagnostics in the fallback path.
- Left non-transient spawn startup errors fail-closed.

## 7. Validation commands run

- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `CI=1 bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `bun run typecheck:all`
- `bun run lint`
- `bun run test:units`
- `bun run build`
- `bun run validate:rebrand`
- `NODE_OPTIONS=--max-old-space-size=2048 bun run validate:ci`

## 8. Passing test output summary

After implementation, the isolated transform-data retry suite passed with 7
pass, 0 fail, and 25 expect calls. The new fallback case exhausted all six
mocked Node spawn attempts, then succeeded through the native Bun fallback and
wrote `out.json`.

The direct path containment suite passed with 8 pass, 0 fail, and 16 expect
calls. `CI=1` direct containment also passed before implementation with 8 pass,
0 fail, proving local execution did not reproduce the hosted EBADF directly.

Docs validation passed with 462 tickets and 7 required docs. `typecheck:all`
passed. `lint` passed with the existing 7 warnings and 0 errors. `git diff
--check` passed. `validate:rebrand` passed with no forbidden tokens outside the
allowlist.

`bun run test:units` completed with exit 0. The command ran the regular `bun
test` suite and every discovered `.isolated.ts`; because local child-agent
worktrees exist under `.claude/worktrees`, the isolated sweep also covered
their isolated files before finishing green.

`validate:ci` passed under `NODE_OPTIONS=--max-old-space-size=2048`, including
agent-contract, architecture docs, CI contract, private release pipeline,
`validate:dev`, audit smoke, and i18n parity/sort/coverage.

## 9. Build output summary

`bun run build` passed. The Electron build completed main, preload, renderer,
resources, and asset copy stages. Vite emitted the existing dynamic-import and
large-chunk warnings, then exited successfully. The build did not leave any
tracked generated resource changes for this handler update.

## 10. Remaining risks

The original failure only reproduced on the hosted CircleCI runner. PR #228
later merged at `a93d6baebb13fb52979cf89819db9ede9aabc07b` with CircleCI
`validate` green, so the hosted proof risk is now reconciled by T496. Residual
risk is limited to future hosted Bun/Node spawn regressions outside the
observed transient `EBADF` class.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| RED demonstrates exhausted Node transient `EBADF` startup retries still fail before the fallback implementation | PASS | New isolated test failed with `Expected: false / Received: true` before implementation |
| Transform-data falls back to native `Bun.spawn` after exhausted transient Node spawn startup retries | PASS | Isolated retry suite passed; fallback case exhausted six Node attempts and wrote output |
| Non-transient spawn startup errors still fail closed without fallback | PASS | Existing isolated non-transient guard stayed green |
| Direct transform-data path containment tests pass | PASS | Direct containment suite passed with 8 pass, 0 fail |
| CircleCI-equivalent local unit gate passes | PASS | `bun run test:units` completed with exit 0 |
| No destructive R.11 action is performed | PASS | No destructive R.11 command has been run |
