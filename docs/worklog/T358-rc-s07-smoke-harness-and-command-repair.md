# T358 - RC S07 Smoke Harness And Command Repair

## 1. Task Summary

Register the RC S07 smoke scenario so sync conflict validation can be rerun
through the shared `e2e:smoke` harness.

## 2. Repo Context Discovered

`T345` requires `bun run e2e:smoke -- --scenario
s07-sync-conflict-resolution`, but the harness only registered S01 through S06.
The ticket also referenced a stale sync glob that matched no test files.

Current deterministic S07-adjacent coverage lives in explicit local/cloud sync,
workspace sync service, and multi-client conflict tests under
`packages/server-core/src/sync/__tests__/`.

## 3. Files Inspected

- `docs/tickets/T345-rc-s07-sync-conflict-resolution.md`
- `docs/tickets/T358-rc-s07-smoke-harness-and-command-repair.md`
- `docs/worklog/T345-rc-s07-sync-conflict-resolution.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
- `packages/server-core/src/sync/__tests__/workspace-sync-service.test.ts`
- `packages/server-core/src/sync/__tests__/workspace-sync-multi-client-conflict.test.ts`

## 4. Tests Added First

Added a failing S07 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
error: Unsupported scenario "s07-sync-conflict-resolution". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac, s06-file-upload-entity-graph
```

The first run exited with 7 pass, 1 fail, and 31 expectations before
implementation.

## 6. Implementation Changes

- Registered `s07-sync-conflict-resolution` in `scripts/e2e-smoke.ts`.
- Routed S07 to current local/cloud sync, workspace sync service, and
  multi-client conflict tests.
- Updated T345 validation commands from a stale glob to current explicit test
  paths.
- Marked `T358` as `Status: DONE`.
- Updated T345 worklog and RC evidence to show the harness registration is
  complete while packaged S07 screenshots remain pending.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s07-sync-conflict-resolution
status=0; bun run e2e:smoke -- --scenario s01-registration || status=$?; printf 'exit_code=%s\n' "$status"; test "$status" -eq 78
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Initial S07 harness contract failed for the expected unsupported-scenario
  reason, then passed after implementation: 8 pass, 0 fail, 35 expectations.
- `bun run e2e:smoke -- --scenario s07-sync-conflict-resolution`: pass, 23
  tests, 4 todo, 0 fail, 70 expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- `bun run validate:agent-contract`, `bun run validate:docs`, `bun run
  validate:rebrand`, `bun run validate:roadmap`, and `git diff --check`
  passed.

## 9. Build Output Summary

No build was run. The change is a smoke harness registration plus documentation
repair and does not change runtime application behavior.

## 10. Remaining Risks

- S07 still needs packaged Electron conflict-modal screenshots and
  browser-console evidence before T345 can move to `DONE`.
- The S07 harness currently uses deterministic server-core tests rather than a
  packaged conflict-resolution UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Harness contract test fails before implementation for unsupported S07 | Pass | Initial harness test exited 1 with unsupported S07 |
| `s07-sync-conflict-resolution` is listed in supported scenarios | Pass | Harness test passes and `e2e:smoke` runs S07 |
| S07 smoke runs current local/cloud sync tests | Pass | S07 smoke includes `local-cloud-sync.test.ts` |
| S07 smoke runs current workspace sync service tests | Pass | S07 smoke includes `workspace-sync-service.test.ts` |
| S07 smoke runs current multi-client conflict tests | Pass | S07 smoke includes `workspace-sync-multi-client-conflict.test.ts` |
| T345 no longer references the stale sync glob | Pass | Harness test asserts stale glob is absent |
| Existing S01 Linux host-blocker behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Worklog captures red/green evidence | Pass | This worklog records the failing and passing commands |
