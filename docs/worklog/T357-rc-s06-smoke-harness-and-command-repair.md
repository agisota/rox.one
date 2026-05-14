# T357 - RC S06 Smoke Harness And Command Repair

## 1. Task Summary

Register the RC S06 smoke scenario so the file upload/entity graph/source-link
validation path can be rerun through the shared `e2e:smoke` harness.

## 2. Repo Context Discovered

`T344` requires `bun run e2e:smoke -- --scenario
s06-file-upload-entity-graph`, but the harness only registered S01 through S05.
The ticket also referenced stale file/entity graph globs that matched no test
files.

Current deterministic S06-adjacent coverage lives in explicit file RPC/path
validation tests, the Markdown entity graph test, renderer file-change tests,
and session file-watch tests.

## 3. Files Inspected

- `docs/tickets/T344-rc-s06-file-upload-entity-graph.md`
- `docs/tickets/T357-rc-s06-smoke-harness-and-command-repair.md`
- `docs/worklog/T344-rc-s06-file-upload-entity-graph.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts`
- `packages/server-core/src/handlers/rpc/files.test.ts`
- `packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts`
- `packages/server-core/src/handlers/__tests__/validate-file-path.test.ts`
- `apps/electron/src/renderer/lib/__tests__/file-changes.test.ts`
- `apps/electron/src/renderer/components/right-sidebar/__tests__/session-files-watch.test.ts`

## 4. Tests Added First

Added a failing S06 harness/path contract to
`scripts/__tests__/e2e-smoke-harness.test.ts`.

## 5. Expected Failing Test Output

```text
error: Unsupported scenario "s06-file-upload-entity-graph". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac
```

The first run exited with 6 pass, 1 fail, and 25 expectations before
implementation.

## 6. Implementation Changes

- Registered `s06-file-upload-entity-graph` in `scripts/e2e-smoke.ts`.
- Routed S06 to current Markdown entity graph, file RPC, file path/scope,
  renderer file-change, and session file-watch tests.
- Updated T344 validation commands from stale globs to current explicit test
  paths.
- Marked `T357` as `Status: DONE`.
- Updated T344 worklog and RC evidence to show harness registration is complete
  while packaged S06 screenshots remain pending.

## 7. Validation Commands Run

```bash
bun test scripts/__tests__/e2e-smoke-harness.test.ts
bun run e2e:smoke -- --scenario s06-file-upload-entity-graph
status=0; bun run e2e:smoke -- --scenario s01-registration || status=$?; printf 'exit_code=%s\n' "$status"; test "$status" -eq 78
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Initial S06 harness contract failed for the expected unsupported-scenario
  reason, then passed after implementation: 7 pass, 0 fail, 31 expectations.
- `bun run e2e:smoke -- --scenario s06-file-upload-entity-graph`: pass, 30
  tests, 0 fail, 52 expectations.
- `bun run e2e:smoke -- --scenario s01-registration`: still exits code 78 with
  the expected `darwin` host-environment blocker on this Linux host.
- `bun run validate:agent-contract`, `bun run validate:docs`, `bun run
  validate:rebrand`, `bun run validate:roadmap`, and `git diff --check`
  passed.

## 9. Build Output Summary

No build was run. The change is a smoke harness registration plus documentation
repair and does not change runtime application behavior.

## 10. Remaining Risks

- S06 still needs packaged Electron upload/entity graph/source-link screenshots
  and browser-console evidence before T344 can move to `DONE`.
- The S06 harness currently uses deterministic server/shared/renderer tests
  rather than a packaged file-upload UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| Harness contract test fails before implementation for unsupported S06 | Pass | Initial harness test exited 1 with unsupported S06 |
| `s06-file-upload-entity-graph` is listed in supported scenarios | Pass | Harness test passes and `e2e:smoke` runs S06 |
| S06 smoke runs current file manager/path validation tests | Pass | S06 smoke includes files RPC, file-manager scopes, and path validation tests |
| S06 smoke runs current markdown entity graph tests | Pass | S06 smoke includes `markdown-entity-graph.test.ts` |
| S06 smoke runs current source-link-adjacent renderer tests | Pass | S06 smoke includes file-change and session file-watch renderer tests |
| T344 no longer references stale workbench/entity-graph globs | Pass | Harness test asserts stale globs are absent |
| Existing S01 Linux host-blocker behavior is unchanged | Pass | S01 still exits 78 on Linux with explicit darwin requirement |
| Worklog captures red/green evidence | Pass | This worklog records the failing and passing commands |
