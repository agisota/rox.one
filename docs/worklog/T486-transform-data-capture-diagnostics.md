# T486 - Transform data capture diagnostics preservation

Status: DONE
Phase: Post-merge hardening
Ticket: docs/tickets/T486-transform-data-capture-diagnostics.md

## 1. Task summary

Close the PR #218 post-merge review gap where file-backed stdout/stderr capture
could hide diagnostics if the capture files could not be read.

## 2. Repo context discovered

PR #218 moved transform-data away from child-process pipe stdio to avoid hosted
Bun `EBADF` pipe startup failures. The new file-backed capture helper caught
all read failures and returned an empty string. That behavior is safe for the
process lifecycle but poor for operator diagnostics: a failed script can lose
stderr/stdout evidence and degrade to a generic non-zero-code message.

## 3. Files inspected

- `packages/session-tools-core/src/handlers/transform-data.ts`
- `packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `packages/session-tools-core/src/handlers/transform-data.test.ts`

## 4. Tests added first

Added two isolated transform-data tests before implementation:

- non-zero scripts preserve stderr output;
- capture read failures are surfaced in the error message.

## 5. Expected failing test output

The RED run failed for the intended reason before implementation:

```text
Expected to contain: "Failed to read stderr capture"
Received: "[ERROR] Script failed (exit code 7):\nScript exited with non-zero code"

(fail) transform_data transient spawn retry > surfaces capture read failures instead of hiding script diagnostics
```

## 6. Implementation changes

- Changed capture-file reads to return `{ text, readError }` instead of hiding
  read failures as empty strings.
- Appended stdout/stderr capture read failures to stderr diagnostics so
  non-zero and timeout paths can report the capture problem.
- Reused a shared error-message formatter for spawn and capture errors.

## 7. Validation commands run

- `bun test ./packages/session-tools-core/src/handlers/transform-data-spawn-retry.isolated.ts`
- `bun test ./packages/session-tools-core/src/handlers/transform-data.test.ts`
- `bun run validate:docs`
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- `transform-data-spawn-retry.isolated.ts`: 6 pass, 0 fail, 22 expect calls.
- `transform-data.test.ts`: 8 pass, 0 fail, 16 expect calls.
- `bun run validate:docs`: passed (`agent-contract`, `architecture-docs`,
  `sync-v2-design`).
- `bun run typecheck`: passed.
- `bun run lint`: passed with 7 existing warnings, 0 errors.
- `bun test`: 6918 pass, 13 skip, 0 fail, 1 snapshot, 27571 expect calls.

## 9. Build output summary

`bun run build` passed. The build completed Electron main, preload, renderer,
resources, and asset steps; Vite emitted existing chunk-size/manual-chunk
warnings but exited successfully.

## 10. Remaining risks

Timeout diagnostics use the same capture-read helper, but this ticket avoids a
long timeout-specific test because the production timeout is 30 seconds.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| Non-zero transform scripts include stderr diagnostics | PASS | `transform-data-spawn-retry.isolated.ts`: 6 pass, 0 fail |
| Capture read failures are visible in the returned error message | PASS | `transform-data-spawn-retry.isolated.ts`: 6 pass, 0 fail |
| Transform-data path containment tests still pass | PASS | `transform-data.test.ts`: 8 pass, 0 fail |
| Full `bun test` still passes | PASS | `bun test`: 6918 pass, 13 skip, 0 fail |
| No destructive R.11 action is performed | PASS | No destructive R.11 command has been run |
