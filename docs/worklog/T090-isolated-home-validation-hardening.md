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
- Ticket/worklog/release-doc status reconciliation still remains after code/test
  hardening.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Fresh/isolated HOME no longer crashes on config-default reads in validated paths | Done | Isolated-home focused regression suite passed |
| Workspace creation and backend factory tests pass under isolated HOME | Done | Isolated-home focused regression suite passed |
| Runtime refresh payload-shape test reflects real configured connection state and passes | Done | `refresh-connection-runtime.test.ts` passed |
| Targeted focused validation commands are recorded | Done | This worklog section 7 |
| Remaining risks documented precisely | Done | This worklog section 10 |
| Worklog complete | Done | Implementation and validation evidence recorded |
| Scoped Lore commit exists | Done | This task is finalized in its scoped Lore commit |
