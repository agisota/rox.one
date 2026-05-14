# T346 - RC Scenario S08: Share Session Shortlink

## 1. Task Summary

Validate RC Scenario S08: session sharing produces a safe public shortlink and
current deterministic share provider/UI-state coverage is recorded against the
RC evidence table.

## 2. Repo Context Discovered

`T346` is a validation-only Phase 20 ticket. It says to file blocking tickets for
regressions instead of changing runtime behavior in this ticket.

The shared RC smoke harness registers S01 through S07 after T358, but
`s08-share-session-shortlink` is not registered. The S08 smoke command exits at
the harness before it can run current share coverage.

The T346 shortlink/share globs match zero files. Current coverage exists in
explicit session share provider, share provider contract, share error mapping,
and renderer share-flow state tests.

## 3. Files Inspected

- `docs/tickets/T346-rc-s08-share-session-shortlink.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/sessions/share-errors.test.ts`
- `packages/server-core/src/sessions/session-share-provider.test.ts`
- `apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts`

## 4. Tests Added First

No code test was added in this validation-only ticket. The red validation checks
are the required S08 smoke command and the T346-listed shortlink/share globs.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s08-share-session-shortlink
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s08-share-session-shortlink". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac, s06-file-upload-entity-graph, s07-sync-conflict-resolution
error: script "e2e:smoke" exited with code 1
```

The T346-listed validation paths also failed because their filters matched zero
files:

```text
The following filters did not match any test files:
 packages/server-core/src/**/__tests__/shortlink*.test.ts

The following filters did not match any test files:
 packages/shared/src/**/__tests__/share*.test.ts

The following filters did not match any test files:
 packages/shared/src/**/__tests__/share-payload-secret*.test.ts
```

## 6. Implementation Changes

- Marked `T346` as `Status: Blocked`.
- Filed blocker ticket `T359-rc-s08-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S08 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

After T359, the S08 smoke command reaches the harness and passes current
deterministic share provider/UI-state coverage:

```text
[e2e-smoke] pass s08-share-session-shortlink
20 pass
0 fail
76 expect() calls
```

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s08-share-session-shortlink
bun test packages/server-core/src/**/__tests__/shortlink*.test.ts
bun test packages/shared/src/**/__tests__/share*.test.ts
bun test packages/shared/src/**/__tests__/share-payload-secret*.test.ts
bun test packages/server-core/src/sessions/share-provider.test.ts packages/server-core/src/sessions/share-errors.test.ts packages/server-core/src/sessions/session-share-provider.test.ts apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s08-share-session-shortlink
```

## 8. Passing Test Output Summary

- Current adjacent share shortlink/provider tests: 20 pass, 0 fail, 76
  expectations.
- `bun test scripts/__tests__/e2e-smoke-harness.test.ts`: 9 pass, 0 fail, 42
  expectations.
- `bun run e2e:smoke -- --scenario s08-share-session-shortlink`: 20 pass, 0
  fail, 76 expectations.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes.

## 10. Remaining Risks

- S08 has not produced packaged Electron share-flow screenshots or
  browser-console evidence.
- The passing tests prove deterministic share provider/state behavior, not a full
  packaged public shortlink UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Share action from a session view produces a shortlink URL | Partial | Session share provider tests pass; packaged UI smoke pending |
| URL pattern is well-formed with no embedded tokens | Partial | Share provider contract tests pass; packaged UI smoke pending |
| Share-status indicator transitions through copying to copied | Partial | Renderer share-flow state tests pass; packaged UI smoke pending |
| Opening shortlink without auth renders shared content | Blocked | No packaged public viewer/browser smoke ran |
| Shortlink payload contains no token or tenant secret | Partial | Share provider sanitization tests pass |
| Expired shortlink returns 410 Gone | Blocked | No packaged public viewer/browser smoke ran |
| Screenshot evidence captured and referenced | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S08 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S08 is `Blocked` |
| Initial blocking ticket filed | Pass | `T359-rc-s08-smoke-harness-and-command-repair.md` |
| S08 deterministic harness path repaired | Pass | T359 registers S08 and `e2e:smoke` passes 20 tests |
