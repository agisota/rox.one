# T359 - RC S08 Smoke Harness And Command Repair

## 1. Task Summary

Register the RC S08 smoke scenario so share session/public shortlink validation
can be rerun through the shared `e2e:smoke` harness.

## 2. Repo Context Discovered

`T346` requires `bun run e2e:smoke -- --scenario
s08-share-session-shortlink`, but the harness only registered S01 through S07.
The ticket also referenced stale shortlink/share globs that matched no test
files.

Current deterministic S08-adjacent coverage lives in explicit session share
provider, share provider contract, share error mapping, and renderer share-flow
state tests.

## 3. Files Inspected

- `docs/tickets/T346-rc-s08-share-session-shortlink.md`
- `docs/tickets/T359-rc-s08-smoke-harness-and-command-repair.md`
- `docs/worklog/T346-rc-s08-share-session-shortlink.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/sessions/share-errors.test.ts`
- `packages/server-core/src/sessions/session-share-provider.test.ts`
- `apps/electron/src/renderer/components/app-shell/__tests__/session-share-flow.test.ts`

## 4. Tests Added First

Added a failing S08 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
error: Unsupported scenario "s08-share-session-shortlink". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac, s06-file-upload-entity-graph, s07-sync-conflict-resolution
```

The first run exited with 8 pass, 1 fail, and 35 expectations before
implementation.

## 6. Implementation Changes

- Registered `s08-share-session-shortlink` in `scripts/e2e-smoke.ts`.
- Routed S08 to current share provider contract, share error mapping, session
  share provider integration, and renderer share-flow state tests.
- Updated T346 validation commands from stale globs to current explicit test
  paths.
- Marked `T359` as `Status: DONE`.
- Updated T346 worklog and RC evidence to show the harness registration is
  complete while packaged S08 screenshots remain pending.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s08-share-session-shortlink
status=0; bun run e2e:smoke -- --scenario s01-registration || status=$?; printf 'exit_code=%s\n' "$status"; test "$status" -eq 78
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Initial S08 harness contract failed for the expected unsupported-scenario
  reason, then passed after implementation: 9 pass, 0 fail, 42 expectations.
- `bun run e2e:smoke -- --scenario s08-share-session-shortlink`: pass, 20
  tests, 0 fail, 76 expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- `bun run validate:agent-contract`, `bun run validate:docs`, `bun run
  validate:rebrand`, `bun run validate:roadmap`, and `git diff --check`
  passed.

## 9. Build Output Summary

No build was run. The change is a smoke harness registration plus documentation
repair and does not change runtime application behavior.

## 10. Remaining Risks

- S08 still needs packaged Electron public shortlink screenshots and
  browser-console evidence before T346 can move to `DONE`.
- The S08 harness currently uses deterministic server-core/renderer state tests
  rather than a packaged share-flow/public-viewer browser run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Harness contract test fails before implementation for unsupported S08 | Pass | Initial harness test exited 1 with unsupported S08 |
| `s08-share-session-shortlink` is listed in supported scenarios | Pass | Harness test passes and `e2e:smoke` runs S08 |
| S08 smoke runs current session share provider integration tests | Pass | S08 smoke includes `session-share-provider.test.ts` |
| S08 smoke runs current share provider contract/security tests | Pass | S08 smoke includes `share-provider.test.ts` |
| S08 smoke runs current share error mapping tests | Pass | S08 smoke includes `share-errors.test.ts` |
| S08 smoke runs current renderer share-flow state tests | Pass | S08 smoke includes `session-share-flow.test.ts` |
| T346 no longer references stale shortlink/share globs | Pass | Harness test asserts stale globs are absent |
| Existing S01 Linux host-blocker behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Worklog captures red/green evidence | Pass | This worklog records the failing and passing commands |
