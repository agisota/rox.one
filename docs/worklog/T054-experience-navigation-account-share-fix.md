# T054 - Experience Navigation, Account Session, and Share Diagnostics

## 1. Task summary

Fix the user-visible gaps reported from the running app:

- Experience/gamification screens from the PRD were present only as embedded artifacts, not navigable product surfaces.
- Public session sharing failed with a generic `Failed to upload session`.
- Desktop account login could show a success message while `/api/account/me` still returned `Authentication required`.
- The account page led with white-label metadata instead of the user's cabinet.

## 2. Repo context discovered

- `docs/product/experience-layer-system-prd.md` lists Deep Missions, Agent Collection/Arena Builder, Mission Control, Progression, Quest Map, Agent Forge, Metrics, and Account surfaces.
- Existing Experience components live under `apps/electron/src/renderer/components/workbench`.
- Existing shell navigation is controlled through shared routes, `route-parser`, `NavigationContext`, `AppShell`, and `MainContentPanel`.
- Account settings used renderer-side `fetch` against `https://rox.one` for desktop mode; this can accept login but fail to persist/send account cookies on the follow-up `/api/account/me`.
- Public sharing flows through `SessionManager.shareToViewer()` and `SessionManager.updateShare()`, which post to the remote viewer API and previously returned generic failure strings.

## 3. Files inspected

- `docs/product/experience-layer-system-prd.md`
- `apps/electron/src/shared/types.ts`
- `apps/electron/src/shared/routes.ts`
- `apps/electron/src/shared/route-parser.ts`
- `apps/electron/src/renderer/contexts/NavigationContext.tsx`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/MainContentPanel.tsx`
- `apps/electron/src/renderer/components/workbench/*`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `apps/electron/src/preload/bootstrap.ts`
- `apps/electron/src/main/index.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/shared/src/protocol/dto.ts`

## 4. Tests added first

- `apps/electron/src/shared/__tests__/route-parser-workbench.test.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/workbench-route-page.test.tsx`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts`
- `apps/electron/src/main/__tests__/account-api.test.ts`
- `packages/server-core/src/sessions/share-errors.test.ts`

## 5. Expected failing test output

- `route-parser-workbench.test.ts`: `routes.view.workbench is not a function`; workbench routes parsed as `null`.
- `workbench-route-page.test.tsx`: `Cannot find module '../WorkbenchRoutePage'`.
- `account-auth-feedback.test.ts`: `Cannot find module '../account-auth-feedback'`.
- `account-api.test.ts`: `Cannot find module '../account-api'`.
- `share-errors.test.ts`: `Cannot find module './share-errors'`.

## 6. Implementation changes

- Added `WorkbenchScreen`, `WorkbenchNavigationState`, route builders, route parsing, route roundtrip, and navigation-state helpers.
- Added `WorkbenchRoutePage` to render Deep Missions, Arena Builder, Mission Control, Progression, Quest Map, and Agent Forge as first-class screens.
- Added an `Experience` section in the left app shell navigation with the PRD screens as direct entries.
- Rendered workbench routes through `MainContentPanel`.
- Reworked account success messaging so sign-in/register success appears only after `/api/account/me` confirms an account user.
- Moved white-label product/legal/support/docs metadata out of the primary account cabinet and into a compact footer area.
- Added a main-process `accountRequest` IPC proxy with a bounded account/auth API allowlist and in-memory session cookie continuity.
- Added share error mapping for auth failures, oversized payloads, and viewer HTTP failures.

## 7. Validation commands run

```bash
bun test apps/electron/src/main/__tests__/account-api.test.ts apps/electron/src/renderer/components/workbench/__tests__ apps/electron/src/shared/__tests__/route-parser-workbench.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-feedback.test.ts packages/server-core/src/sessions/share-errors.test.ts
bun test apps/electron/src/transport/__tests__/channel-map-parity.test.ts apps/electron/src/main/__tests__/account-api.test.ts
bun run validate:agent-contract
bun run typecheck:shared
bun run typecheck:electron
cd packages/server-core && bun run typecheck
bun run electron:build
bun run electron:smoke
bun run lint:electron
bun run electron:start
```

## 8. Passing test output summary

- Targeted tests: `55 pass`, `0 fail`, `188 expect() calls`.
- IPC parity/account tests: `5 pass`, `0 fail`, `1095 expect() calls`.
- `validate:agent-contract`: `ok: 11 skills, 43 tickets, 7 required docs`.
- `typecheck:shared`: passed.
- `typecheck:electron`: passed after adding `accountRequest` to the direct-IPC parity exclusion list.
- `packages/server-core` typecheck: passed.
- `lint:electron`: passed.

## 9. Build output summary

- `bun run electron:build`: passed. Main, preload, renderer, resources, and assets were built.
- `bun run electron:smoke`: passed outside the Codex sandbox with `ROX_SERVER_URL=` and `App initialized successfully` markers. The in-sandbox attempt aborted before app code with Electron `SIGABRT`; verifying `electron --version` outside sandbox confirmed this was a sandbox/GUI launch constraint, not a runtime regression.
- `bun run electron:start`: running from repo root. The app restored `route=workbench/agent-forge`, opened a 1400x900 window, connected the renderer client, and logged `App initialized successfully`.

## 10. Remaining risks

- Public session shortlink creation still depends on the remote viewer API accepting uploads and account/auth policy. The local fix preserves the actual auth/status failure instead of hiding it as `Failed to upload session`.
- The desktop account proxy keeps the account cookie in memory for the current app process. Persistent cross-restart account sessions should be a separate hardening ticket if required.
- Existing unrelated dirty files were present before this fix and were not included in this task.
- Running the app writes scheduler events to the pre-existing dirty `events.jsonl`; that runtime file is intentionally excluded from this task.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Experience screens are reachable from app shell | PASS | route parser and `WorkbenchRoutePage` tests |
| Deep Missions / Arena / Mission Control / Progression / Quest Map / Agent Forge render | PASS | `workbench-route-page.test.tsx`, existing workbench component tests |
| Account login success requires confirmed account user | PASS | `account-auth-feedback.test.ts` |
| Desktop account cookie continues from login to account refresh | PASS | `account-api.test.ts` |
| Account page is user-first | PASS | UI code moves brand metadata to footer and renders user-centered hero |
| Share failures are actionable | PASS | `share-errors.test.ts` |
| Broader validation | PASS | agent contract, typechecks, electron lint, build, smoke, and app launch passed |
