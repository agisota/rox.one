# T345 - RC Scenario S07: Sync Conflict Resolution

## 1. Task Summary

Validate RC Scenario S07: a local/cloud sync conflict is detected, not silently
overwritten, and current deterministic sync coverage is recorded against the RC
evidence table.

## 2. Repo Context Discovered

`T345` is a validation-only Phase 20 ticket. It says to file blocking tickets for
regressions instead of changing runtime behavior in this ticket.

The shared RC smoke harness registers S01 through S06 after T357, but
`s07-sync-conflict-resolution` is not registered. The S07 smoke command exits at
the harness before it can run current sync coverage.

The T345 sync glob matches zero files. Current coverage exists in explicit
local/cloud sync, workspace sync service, and multi-client conflict tests under
`packages/server-core/src/sync/__tests__/`.

## 3. Files Inspected

- `docs/tickets/T345-rc-s07-sync-conflict-resolution.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
- `packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts`
- `packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts`

## 4. Tests Added First

No code test was added in this validation-only ticket. The red validation checks
are the required S07 smoke command and the T345-listed sync glob.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s07-sync-conflict-resolution
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s07-sync-conflict-resolution". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac, s06-file-upload-entity-graph
error: script "e2e:smoke" exited with code 1
```

The T345-listed sync glob also failed because its filter matched zero files:

```text
The following filters did not match any test files:
 packages/server-core/src/**/__tests__/sync*.test.ts
```

## 6. Implementation Changes

- Marked `T345` as `Status: Blocked`.
- Filed blocker ticket `T358-rc-s07-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S07 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s07-sync-conflict-resolution
bun test packages/server-core/src/**/__tests__/sync*.test.ts
bun test packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts
```

## 8. Passing Test Output Summary

- Current adjacent sync conflict tests: 23 pass, 4 todo, 0 fail, 70
  expectations.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes.

## 10. Remaining Risks

- S07 smoke harness entry is not registered yet; T358 tracks that repair.
- S07 has not produced packaged Electron conflict-modal screenshots or
  browser-console evidence.
- The passing tests prove deterministic sync conflict behavior, not a full
  packaged conflict-resolution UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Push of locally modified workspace is accepted | Partial | Local/cloud and workspace sync tests pass; packaged UI smoke pending |
| Pull of conflicting remote state halts auto-sync and surfaces modal | Partial | Sync conflict tests pass; packaged UI modal evidence pending |
| Conflict modal shows local vs cloud clearly | Blocked | No packaged conflict-modal screenshot captured |
| Keep local / keep cloud resolution updates expected side | Partial | Deterministic sync tests pass; UI resolution smoke pending |
| Silent overwrite never occurs | Partial | Conflict tests reject divergent overwrites |
| Conflict resolution recorded in persistence table | Partial | Operation log tests pass; packaged persistence smoke pending |
| Screenshot evidence captured and referenced | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S07 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S07 is `Blocked` |
| Initial blocking ticket filed | Pass | `T358-rc-s07-smoke-harness-and-command-repair.md` |
