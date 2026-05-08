# T090 - Isolated Home Validation Hardening Worklog

## 1. Task summary

Harden clean-environment startup/runtime behavior and remove the highest-leverage
focused validation blockers that prevent the repo from behaving consistently in
an isolated `HOME`.

## 2. Repo context discovered

- `T089` targeted tests currently pass.
- Prior T088/T089 worklogs record unrelated isolated-home test failures.
- Reproduced focused failures now show two main blocker classes:
  1. `loadConfigDefaults()` throws when `~/.rox/config-defaults.json` has not
     been bootstrapped in a fresh HOME.
  2. `refreshConnectionRuntime` shape-check test expects runtime payload fields
     without actually configuring a matching connection in the temp workspace.
- These blockers are high leverage because they affect startup robustness and
  test/reality consistency.

## 3. Files inspected

- `docs/tickets/T089-runtime-module-depth-and-action-seams.md`
- `docs/worklog/T089-runtime-module-depth-and-action-seams.md`
- `packages/server-core/src/sessions/refresh-connection-runtime.test.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/server-core/src/sessions/runtime-config.ts`
- `packages/shared/src/config/storage.ts`
- `packages/shared/src/workspaces/storage.ts`
- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`
- `packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `packages/shared/src/agent/claude-agent.ts`
- `packages/shared/src/agent/backend/factory.ts`

## 4. Tests added first

Planned:

- Add/adjust isolated-home regression coverage so `loadConfigDefaults()`
  self-heals by initializing config defaults instead of throwing on first read.
- Adjust the runtime refresh payload-shape test to create a real configured
  connection/workspace state before asserting the forwarded payload shape.

## 5. Expected failing test output

Initial reproduced command:

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts \
  packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts \
  packages/shared/src/agent/backend/__tests__/factory.test.ts
```

Observed failures before implementation:

- `expect(received).toMatchObject(expected)` because `payload.runtime` was
  `undefined` in `refresh-connection-runtime.test.ts` while the test had not
  configured a real matching connection.
- `config-defaults.json not found at /private/tmp/craft-bun-test-home/.rox/config-defaults.json`
  in `default-workspace-bundle.test.ts`.
- The same missing-config-defaults crash in `factory.test.ts`.

## 6. Implementation changes

- `packages/shared/src/config/storage.ts`
  - `loadConfigDefaults()` now self-heals a missing config defaults file by
    ensuring the config directory exists and invoking the existing
    `ensureConfigDefaults()` bootstrap path before reading.
  - `syncConfigDefaults()` now only short-circuits when the defaults file still
    exists, which fixes same-process isolated-home tests that delete the temp
    config directory between cases after the module-level sync flag has already
    been set.
- `packages/shared/src/config/__tests__/storage-migrations.test.ts`
  - Added subprocess-backed regression coverage for a fresh `CRAFT_CONFIG_DIR`
    so the module-level config constants are initialized against the isolated
    path and `loadConfigDefaults()` creates `config-defaults.json` instead of
    throwing.
- `packages/server-core/src/sessions/refresh-connection-runtime.test.ts`
  - Added isolated `CRAFT_CONFIG_DIR` setup/cleanup.
  - Updated the runtime payload shape check to save a real fake-compatible LLM
    connection before asserting refresh payload fields.

## 7. Validation commands run

```bash
bun test packages/shared/src/workbench/__tests__/experience-runtime-modules.test.ts \
  packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts \
  apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx \
  packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts \
  packages/server-core/src/sessions/share-provider.test.ts
```

Result: PASS (`34 pass, 0 fail`). Confirms T089 targeted surface is green.

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts \
  packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts \
  apps/electron/src/main/handlers/__tests__/session-watcher.test.ts \
  apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts \
  packages/shared/src/agent/backend/__tests__/factory.test.ts
```

Result before implementation: FAIL.

Current reproduced failures in changed scope:

- `refresh-connection-runtime.test.ts`: payload shape mismatch due to missing
  configured connection/runtime.
- `default-workspace-bundle.test.ts`: missing `config-defaults.json` in fresh
  HOME.
- `factory.test.ts`: missing `config-defaults.json` in fresh HOME.

Watcher tests were deferred initially because the three failures above were the
more direct startup/runtime blockers. After the fix landed, the previously
deferred watcher slice was re-run under isolated HOME and passed, confirming
that no adjacent regression was introduced in that area.

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts \
  packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts \
  packages/shared/src/agent/backend/__tests__/factory.test.ts
```

Result after initial implementation: PASS (`49 pass, 1 skip, 0 fail`).

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts \
  packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts \
  apps/electron/src/main/handlers/__tests__/session-watcher.test.ts \
  apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts \
  packages/shared/src/agent/backend/__tests__/factory.test.ts
```

Result after follow-up hardening: PASS (`54 pass, 1 skip, 0 fail`).

```bash
bun test packages/shared/src/config/__tests__/storage-migrations.test.ts
```

Result after implementation: PASS (`12 pass, 0 fail`).

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  apps/electron/src/main/handlers/__tests__/session-watcher.test.ts \
  apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts
```

Result after implementation: PASS (`5 pass, 0 fail`).

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  packages/shared/src/config/__tests__/storage-startup-migration.test.ts \
  packages/shared/src/config/__tests__/default-thinking-level.test.ts \
  packages/shared/src/config/__tests__/llm-connections.test.ts
```

Result after implementation: PASS (`60 pass, 0 fail`).

```bash
env HOME=/private/tmp/craft-bun-test-home bun test \
  packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts \
  apps/electron/src/main/handlers/__tests__/session-watcher.test.ts \
  apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts \
  packages/shared/src/agent/backend/__tests__/factory.test.ts \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts
```

Result after implementation: PASS (`54 pass, 1 skip, 0 fail`).

## 8. Passing test output summary

- Isolated-home focused regression suite: PASS (`49 pass, 1 skip, 0 fail`).
- Expanded isolated-home watcher/factory suite: PASS (`54 pass, 1 skip, 0 fail`).
- Config storage migration/defaults suite: PASS (`12 pass, 0 fail`).
- Touched package typechecks:
  - `cd packages/shared && bun run tsc --noEmit`: PASS, no output.
  - `cd packages/server-core && bun run tsc --noEmit`: PASS, no output.

## 9. Build output summary

No full application build run for T090. The changed surfaces are covered by
focused tests and touched package typechecks. Full `validate:dev` remains a
broader follow-up because prior worklogs record unrelated full-suite blockers.

## 10. Remaining risks

- Broader isolated-home/full-suite validation may still expose additional
  bootstrapping assumptions outside this ticket's focused config/runtime slice.
- This ticket verifies targeted shared/server/electron startup-adjacent paths,
  not the entire monorepo validation surface.
- Ticket/worklog/release-doc status reconciliation was completed in the
  subsequent release-hardening follow-up; remaining risk is now limited to
  broader suite coverage outside this focused slice.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Fresh/isolated HOME no longer crashes on config-default reads in validated paths | Done | Isolated-home focused regression suite passed |
| Workspace creation and backend factory tests pass under isolated HOME | Done | Isolated-home focused regression suite passed |
| Runtime refresh payload-shape test reflects real configured connection state and passes | Done | `refresh-connection-runtime.test.ts` passed |
| Targeted focused validation commands are recorded | Done | This worklog section 7 |
| Remaining risks documented precisely | Done | This worklog section 10 |
| Worklog complete | Done | Implementation and validation evidence recorded |
| Scoped Lore commit exists | Done | `f9b11a5` — `Finalize T090 isolated-home validation hardening`; follow-up release docs also record `8ab5c11` validation reconciliation |

## 12. Release-hardening follow-up addendum

Current diff review uncovered one obvious correctness gap before commit approval:

- `packages/shared/src/config/storage.ts` still had a duplicate `getConfigDir`
  import in the working tree and several config-root-derived paths (`workspaces`,
  `drafts`, app themes) were still captured at module load time, which would
  weaken same-process isolated-config switching.
- `packages/server-core/src/sessions/refresh-connection-runtime.test.ts` parsed
  hermetic subprocess stdout as a single raw JSON blob even though session logs
  may precede the final JSON line.

Follow-up hardening applied:

- removed the duplicate import and converted the remaining config-root-derived
  storage/theme/workspace paths to dynamic helpers so they honor the current
  `CRAFT_CONFIG_DIR` at call time;
- made `ensureConfigDir()` memoize per resolved config dir instead of using a
  single process-global boolean;
- made the hermetic refresh test parse the last non-empty stdout line as JSON,
  which matches the subprocess contract even when debug/session logs are
  present.

Additional validation rerun:

```bash
bun test packages/shared/src/config/__tests__/storage-migrations.test.ts \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts
bun run typecheck:all
git diff --check
```

Results:

- Focused touched-file suite: PASS (`20 pass`, `0 fail`, `31 expect() calls`).
- `bun run typecheck:all`: PASS.
- `git diff --check`: PASS.

## 13. Additional review/fix slice

One more diff review on the remaining changed surface found that the original
same-process `ensureConfigDir()` regression test had been dropped from
`packages/shared/src/config/__tests__/storage-migrations.test.ts` even though
that exact behavior remains an important correctness guard for the new dynamic
`getConfigDir()` / per-config-dir initialization logic.

Fix applied:

- restored the direct same-process regression test that switches
  `CRAFT_CONFIG_DIR` between two temp roots, calls `ensureConfigDir()` twice,
  and asserts both roots bootstrap `config-defaults.json` successfully before
  loading defaults from the second root.

Validation rerun:

```bash
bun test packages/shared/src/config/__tests__/storage-migrations.test.ts \
  packages/server-core/src/sessions/refresh-connection-runtime.test.ts
git diff --check
```

Results:

- Focused regression suite: PASS (`21 pass`, `0 fail`, `34 expect() calls`).
- `git diff --check`: PASS.


## 14. Final documentation/release reconciliation

After the code/test hardening landed, the release-hardening pass also rechecked
repo-document consistency and broader lightweight validation.

Additional validation run:

```bash
bun run validate:docs
bun run lint
bun run electron:build
bun run webui:build
bun run viewer:build
bun run electron:smoke
```

Results:

- `bun run validate:docs`: PASS (`11 skills`, `91 tickets`, `7 required docs`; architecture and sync-v2 design validators green).
- `bun run lint`: PASS with only the same 3 pre-existing React hook dependency warnings and `0 errors`.
- `bun run electron:build`: PASS. Main, preload, renderer, resources, and assets built; Vite reported existing large-chunk warnings only.
- `bun run webui:build`: PASS. Vite build completed; existing large-chunk warnings only.
- `bun run viewer:build`: PASS. Vite build completed; existing large-chunk warnings only.
- `bun run electron:smoke`: PASS. Electron initialized config, credentials, session services, ROX server, messaging gateway, and exited cleanly with `[smoke] Electron headless startup passed`.

Documentation state after reconciliation:

- T088/T089 tickets are marked `DONE` and reference their validated worklogs.
- Release snapshot/final RC/readiness docs now distinguish historical T087
  max-suite evidence from the current narrower T088/T089/T090 reruns.
- T090 is committed in `f9b11a5`; follow-up release-hardening reconciliation is committed in `8ab5c11`.
