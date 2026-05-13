# T344 - RC Scenario S06: File Upload Entity Graph

## 1. Task Summary

Validate RC Scenario S06: uploaded file content produces an entity graph with
source references, and source-link-adjacent renderer/file manager coverage proves
links can route back to the underlying file context.

## 2. Repo Context Discovered

`T344` is a validation-only Phase 20 ticket. It says to file blocking tickets for
regressions instead of changing runtime behavior in this ticket.

The shared RC smoke harness registers S01 through S05 after T356, but
`s06-file-upload-entity-graph` is not registered. The S06 smoke command exits at
the harness before it can run current file/entity graph coverage.

The T344 workbench file and shared entity-graph globs match zero files. Current
coverage exists in explicit file manager/path validation tests, the shared
Markdown entity graph test, renderer file-change tests, and session file-watch
tests.

## 3. Files Inspected

- `docs/tickets/T344-rc-s06-file-upload-entity-graph.md`
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

No code test was added in this validation-only ticket. The red validation checks
are the required S06 smoke command and the T344-listed file/entity graph globs.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s06-file-upload-entity-graph
```

Observed failure:

```text
[e2e-smoke] Unsupported scenario "s06-file-upload-entity-graph". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac
error: script "e2e:smoke" exited with code 1
```

The T344-listed targeted paths also failed because their filters matched zero
files:

```text
The following filters did not match any test files:
 apps/electron/src/renderer/components/workbench/**/__tests__/file*.test.*

The following filters did not match any test files:
 packages/shared/src/**/__tests__/entity-graph*.test.ts
```

## 6. Implementation Changes

- Marked `T344` as `Status: Blocked`.
- Filed blocker ticket `T357-rc-s06-smoke-harness-and-command-repair.md`.
- Updated the RC evidence table row for S06 to `Blocked`.
- Added the blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
bun run e2e:smoke -- --scenario s06-file-upload-entity-graph
bun test apps/electron/src/renderer/components/workbench/**/__tests__/file*.test.*
bun test packages/shared/src/**/__tests__/entity-graph*.test.ts
bun test packages/shared/src/workbench/__tests__/markdown-entity-graph.test.ts packages/server-core/src/handlers/rpc/files.test.ts packages/server-core/src/handlers/__tests__/file-manager-scopes.test.ts packages/server-core/src/handlers/__tests__/validate-file-path.test.ts apps/electron/src/renderer/lib/__tests__/file-changes.test.ts apps/electron/src/renderer/components/right-sidebar/__tests__/session-files-watch.test.ts
```

## 8. Passing Test Output Summary

- Current adjacent file manager/entity graph tests: 30 pass, 0 fail, 52
  expectations.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes.

## 10. Remaining Risks

- S06 smoke harness entry is not registered yet; T357 tracks that repair.
- S06 has not produced packaged Electron UI screenshots or browser-console
  evidence.
- The passing tests prove deterministic file/entity graph behavior, not a full
  packaged upload/source-link UI run.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| User can upload a file through File Manager without errors | Partial | File RPC/path tests pass; packaged UI smoke pending |
| Entity graph is generated and displayed after upload | Partial | Markdown entity graph tests pass; packaged UI smoke pending |
| At least one entity node is present | Partial | Markdown entity graph tests pass |
| Each entity node displays a source-link affordance | Partial | Entity graph sourceRef behavior covered; packaged UI smoke pending |
| Clicking a source link opens correct passage | Blocked | No packaged source-link UI smoke ran |
| Passage-level scroll target is correct | Blocked | No packaged source-link UI smoke ran |
| Screenshot evidence captured and referenced | Blocked | No screenshot captured in current deterministic test harness |
| RC evidence row S06 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S06 is `Blocked` |
| Initial blocking ticket filed | Pass | `T357-rc-s06-smoke-harness-and-command-repair.md` |
