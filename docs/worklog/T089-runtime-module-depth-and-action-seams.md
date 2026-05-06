# T089 - Runtime Module Depth and Action Seams Worklog

## 1. Task summary

Deepen the ROX Experience runtime architecture across three approved focus areas:

- `A`: split `ExperienceRuntimeStore` metric and quest projection into dedicated
  runtime Modules.
- `B`: route Mission Control checkpoint user actions through runtime truth when a
  runtime store is available.
- `C`: harden provider/share Adapter seams so public-share redaction is enforced
  at the seam.

## 2. Repo context discovered

- Current branch: `mac/rox-production-ready-rc`.
- Dirty runtime-local files are unrelated and must not be staged:
  `events.jsonl` and `.claude/`.
- The current release snapshot defines the product truth loop as:
  `UI action -> typed event -> reducer -> persistence seam -> provider/scheduler/share seam -> evidence -> metrics/quests/ledger/UI projection`.
- `packages/shared/src/workbench/mission-lifecycle.ts` is already a good compact
  Module for shared lifecycle rules after T088.
- `packages/shared/src/workbench/experience-runtime-store.ts` is still broad:
  it owns event schema, reducers, persistence, metrics, quests, ledger/capacity,
  trust checks, and notifications.
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
  still uses local state mutation helpers for checkpoint and approval buttons.
- `packages/server-core/src/provider-gateway/provider-gateway.ts` redacts
  public-share metadata but not provider artifact content.
- `packages/server-core/src/sessions/share-provider.ts` exposes sanitization
  helpers, but provider upload/update paths can still accept unsanitized bundles
  if a caller bypasses sanitization.

## 3. Files inspected

- `AGENTS.md`
- `docs/release/current-state-snapshot-2026-05-06.md`
- `docs/worklog/T088-mission-runtime-lifecycle-contract.md`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/mission-lifecycle.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/mission-control-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
- `packages/server-core/src/provider-gateway/provider-gateway.ts`
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
- `packages/server-core/src/sessions/share-provider.ts`
- `packages/server-core/src/sessions/share-provider.test.ts`
- `packages/server-core/src/sessions/session-share-provider.test.ts`

## 4. Cleanup plan

1. Add failing tests before implementation:
   - failed `mission.finalized` must not complete the final deliverable quest;
   - metric/quest projection Modules must exist and be directly testable;
   - Mission Control runtime action must persist events through the runtime store;
   - provider public-share artifact content must be redacted;
   - share provider upload/update must sanitize bundles at the provider seam.
2. Extract metric projection into a dedicated runtime Module.
3. Extract quest graph/progression into a dedicated runtime Module.
4. Add a Mission Control runtime action helper and wire the screen to use it when
   a runtime store is provided.
5. Move fake provider Adapter creation behind a clearer seam and redact public
   artifact content.
6. Sanitize share provider upload/update payloads inside both viewer and fake
   provider paths.
7. Run targeted tests, typecheck, lint, build where relevant.

## 5. Tests added first

- Added `packages/shared/src/workbench/__tests__/experience-runtime-modules.test.ts`.
  It locks direct metric and quest projection Modules, including the rule that
  paid capacity can change capacity metrics but cannot raise VDI.
- Extended `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`
  so forged or failed `mission.finalized` events cannot complete
  `quest-final-verified-deliverable`.
- Extended `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`
  so checkpoint completion dispatches runtime events through an
  `ExperienceRuntimeStore` when one is supplied.
- Extended `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
  so public-share provider artifact content is redacted at the provider gateway.
- Extended `packages/server-core/src/sessions/share-provider.test.ts` so fake and
  viewer share providers sanitize upload/update bundles at the provider seam.

## 6. Expected failing test output

Initial red command:

```bash
bun test packages/shared/src/workbench/__tests__/experience-runtime-modules.test.ts packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/sessions/share-provider.test.ts
```

Expected failures before implementation:

- `Cannot find module '../experience-metric-engine'` and
  `Cannot find module '../experience-quest-engine'`.
- `Export named 'completeMissionCheckpointFromControlAction' not found`.
- Failed/forged finalization completed `quest-final-verified-deliverable`.
- Provider public-share artifact `content` leaked
  `Bearer provider-content-secret` instead of `Bearer [redacted]`.
- Fake/viewer share provider upload/update paths accepted unsanitized bundle
  payloads.

## 7. Implementation changes

- Added `packages/shared/src/workbench/experience-metric-engine.ts` with
  `projectExperienceMetricSnapshots`.
- Added `packages/shared/src/workbench/experience-quest-engine.ts` with
  `EXPERIENCE_QUEST_GRAPH` and `projectExperienceQuestProgress`.
- Rewired `experience-runtime-store.ts` to use the new projection Modules and to
  re-export their public runtime contracts.
- Tightened final-deliverable quest progression: `mission.finalized` now only
  completes the final verified deliverable quest when reducer truth has the
  mission in completed state after evidence/gate checks.
- Added `completeMissionCheckpointFromControlAction` in
  `mission-control-state.ts`; it converts a Mission Control checkpoint button
  action into the same runtime event sequence used by scheduler/runtime flows.
- Updated `MissionControlRunDetail` to use runtime dispatch when a
  `runtimeStore` is provided, while preserving local preview behavior when the
  screen is rendered without runtime truth.
- Added `packages/server-core/src/provider-gateway/provider-gateway-adapters.ts`
  and moved deterministic fake provider adapter creation behind that seam.
- Redacted public-share artifact `content` and metadata in
  `validateAndNormalizeArtifact`.
- Sanitized fake and viewer share provider upload/update bundles inside the
  provider implementation so callers cannot bypass redaction accidentally.

## 8. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-runtime-modules.test.ts packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts packages/server-core/src/sessions/share-provider.test.ts`
- `bun run validate:docs`
- `git diff --check`
- `bun run typecheck:all`
- `bun run lint`
- `bun run electron:build`
- `env HOME=/private/tmp/craft-bun-test-home bun test`
- `env HOME=/private/tmp/craft-bun-test-home bun test packages/server-core/src/sessions/refresh-connection-runtime.test.ts packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts apps/electron/src/main/handlers/__tests__/session-watcher.test.ts apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts packages/shared/src/agent/backend/__tests__/factory.test.ts`
- `bun run electron:smoke`

## 9. Passing test output summary

- Targeted T089 regression suite: `34 pass`, `0 fail`, `153 expect() calls`.
- `bun run validate:docs`: pass. Agent contract, architecture docs, and sync-v2
  design validation all reported `ok`.
- `bun run typecheck:all`: pass after test code was adjusted for a possibly
  undefined quest graph first entry.
- `bun run lint`: pass with pre-existing React hook dependency warnings in
  `apps/electron/src/renderer/App.tsx` and
  `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`.
- `git diff --check`: pass.
- `bun run electron:smoke`: pass after rerun outside the sandbox for GUI launch.
  The first sandboxed run rebuilt successfully but Electron exited with
  `SIGABRT`; the escalated GUI run reached `App initialized successfully` and
  finished with `[smoke] Electron headless startup passed`.
- Full isolated-home `bun test`: `4711 pass`, `13 skip`, `8 fail`,
  `11669 expect() calls`.

## 10. Build output summary

`bun run electron:build` passed:

- Electron main build completed.
- Electron preload build completed.
- Renderer Vite build completed.
- SDK native binary verification completed.
- Vite emitted chunk-size warnings only.

`bun run electron:smoke` also passed outside the sandbox:

- Smoke rebuilt the Electron app.
- The app initialized config, credentials, session services, ROX server, and
  power manager.
- Smoke exited cleanly after successful startup.

## 11. Remaining risks

- Full isolated-home `bun test` still has 8 failures outside the T089 change
  surface:
  - `packages/server-core/src/sessions/refresh-connection-runtime.test.ts`:
    expected IPC payload `runtime` shape is absent/undefined.
  - `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`:
    `config-defaults.json` is missing under `/private/tmp/craft-bun-test-home/.rox/`.
  - `apps/electron/src/main/handlers/__tests__/session-watcher.test.ts` and
    `apps/electron/src/main/handlers/__tests__/sessions-watchers.test.ts`:
    file watcher tests did not receive expected notifications.
  - `packages/shared/src/agent/backend/__tests__/factory.test.ts`: two
    ClaudeAgent tests also fail because isolated HOME lacks
    `/private/tmp/craft-bun-test-home/.rox/config-defaults.json`.
- Mission Control approval actions still use the existing local preview helper
  when no runtime store is supplied. This pass closes checkpoint completion; a
  future ticket should add typed approval events before changing approval truth.
- Real provider/share infrastructure was not exercised by design; tests remain
  deterministic and fake-provider-safe.

## 12. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---:|---|
| Metric and quest projection have dedicated Modules | Pass | `experience-metric-engine.ts`, `experience-quest-engine.ts`, `experience-runtime-modules.test.ts` |
| Failed finalization cannot complete final quest | Pass | `experience-runtime-store.test.ts` targeted regression |
| Mission Control checkpoint action can persist through runtime store | Pass | `mission-control-run-detail.test.tsx` runtime dispatch regression |
| Provider public-share artifact content is redacted | Pass | `provider-gateway.test.ts` public-share content redaction regression |
| Share upload/update sanitizes at provider seam | Pass | `share-provider.test.ts` fake/viewer provider seam regressions |
| Targeted validation passes | Pass | Targeted T089 suite: `34 pass`, `0 fail` |
| Scoped Lore commit exists | Pass | Scoped Lore commit for T089 |
