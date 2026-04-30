# T032 ROX Composer, Account, Teams, Billing/Storage UX Plan

## 1. Task summary

Design the in-app UX and implementation boundary for the next ROX ONE workbench layer:

- Composer mode selector remains the behavioral routing control near the current `Исследовать` affordance.
- Composer action buttons open focused in-app screens/sheets from the current prompt: `Улучшить prompt`, `TDD Plan`, `Проверить`, `Разъебать`, `Собрать ТЗ`, `Ревью`.
- Account, login, registration, teams, spaces, storage, and billing must live inside the ROX ONE UI instead of sending the user into an embedded browser account page.
- DV.net checkout may open externally only after the app creates a backend top-up intent.
- S3-compatible storage must stay backend-only, with user/team buckets and spaces as prefixes.

## 2. Reformulated task

The product should stop treating the top composer controls as a single cramped mode/action hybrid. The top control row should become two explicit concepts:

1. `Mode`: a compact segmented/pill selector that changes how the main submit behaves.
2. `Actions`: buttons that transform or analyze the current prompt and open a dedicated in-app screen with generated artifacts.

The account surface should become a first-class native app section:

1. Unauthenticated users see `Вход`, `Регистрация`, and `Сброс пароля` forms inside ROX ONE.
2. Authenticated users see profile, sessions, teams, spaces, storage, billing, and events inside ROX ONE.
3. Browser panes are not used for account navigation. Only DV.net payment checkout is allowed to leave the app UI.

## 3. Assumptions and boundaries

- No `mise.toml` exists; use existing `package.json` scripts.
- Current dirty files for T031 and auto-update work are not overwritten by this planning pass.
- `rox_organizations` remains the database compatibility layer, but product language becomes `Team`.
- `Team -> Spaces` is the collaboration model. An organization/team owns spaces; spaces own sessions, files, artifacts, and storage prefixes.
- Balance display currency is `USDT`.
- S3 credentials, DV.net secrets, webhook verification, and bucket creation remain server-side only.
- Renderer never receives S3 keys or DV.net signing secrets.
- `http://s3.max:9000` is the preferred backend endpoint; `http://s3.rox:9000` is fallback. UI only shows health/status returned by backend.
- DV.net official docs allow payment form links using `/pay/store/{store-uuid}/{client-id}` and require webhook idempotency by `tx_hash + bc_uniq_key`. Credit only confirmed `PaymentReceived`.

## 4. Repo context discovered

- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx` currently renders a native `<select>` plus action buttons.
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts` currently defaults to `rewrite` and already models mode/action intents.
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx` mounts `ProductModeToolbar`, `PromptRewriteDialog`, and `ThinkingPartnerRoundTableDialog` inside the composer.
- `packages/shared/src/workbench/prompt-rewrite-engine.ts` already provides deterministic prompt rewrite policy.
- `packages/shared/src/workbench/tdd-task-generator.ts` already provides deterministic red/green/verify/worklog task packs.
- `packages/shared/src/workbench/review-board.ts` and `validation-gates.ts` already provide review/verify policy primitives.
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx` currently uses visible and hidden `browserPane` instances against `https://rox.one`.
- `packages/server-core/src/webui/account-teams.ts` already has in-memory team/invite semantics with owner/admin invite checks.
- `infra/rox-one-auth-server.mjs` already contains `rox_organizations` and account/billing endpoints, but not full teams/spaces/storage/top-up webhook persistence.
- `packages/server-core/src/storage/object-storage.ts` already has object storage policy tests and should be reused for S3 path safety.

## 5. Files inspected

- `apps/electron/src/renderer/components/app-shell/input/ProductModeToolbar.tsx`
- `apps/electron/src/renderer/components/app-shell/input/product-mode-toolbar.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/prompt-rewrite-flow.ts`
- `apps/electron/src/renderer/components/app-shell/input/thinking-partner-flow.ts`
- `apps/electron/src/renderer/components/workbench/SpecBuilderScreen.tsx`
- `apps/electron/src/renderer/components/workbench/spec-builder-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx`
- `apps/electron/src/renderer/components/app-shell/input/ComposerArtifactPanel.tsx`
- `apps/electron/src/renderer/components/app-shell/input/composer-artifact-flow.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx`
- `packages/shared/src/workbench/prompt-rewrite-engine.ts`
- `packages/shared/src/workbench/tdd-task-generator.ts`
- `packages/shared/src/workbench/review-board.ts`
- `packages/shared/src/workbench/validation-gates.ts`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ru.json`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
- `apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx`
- `apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx`
- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `packages/server-core/src/webui/account-teams.ts`
- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
- `packages/server-core/src/webui/http-server.ts`
- `packages/server-core/src/webui/account-ledger.ts`
- `packages/server-core/src/storage/object-storage.ts`
- `infra/rox-one-auth-server.mjs`
- `docs/worklog/T017-user-account-cabinet.md`
- `docs/worklog/T021-team-invites-rbac.md`
- `docs/worklog/T022-s3-storage-quotas.md`

## 6. Screen map

```mermaid
flowchart TD
  Shell["ROX ONE App Shell"] --> Composer["Composer"]
  Composer --> ModeBar["Mode Button: Исследовать / Build / Review / TDD / ..."]
  Composer --> ActionBar["Action Buttons"]
  ActionBar --> PromptLab["Prompt Lab Screen"]
  ActionBar --> TddPlan["TDD Plan Screen"]
  ActionBar --> ReviewGate["Review Gate Screen"]
  ActionBar --> SpecBuilder["Spec Builder Screen"]

  Shell --> AccountButton["Account Button"]
  AccountButton --> AccountRoute["Internal Account Page"]
  AccountRoute --> AuthForms["Вход / Регистрация / Сброс"]
  AccountRoute --> Cabinet["Profile / Sessions"]
  AccountRoute --> Teams["Teams"]
  Teams --> Spaces["Team Spaces"]
  AccountRoute --> Storage["Storage"]
  AccountRoute --> Billing["Billing"]
  Billing --> Checkout["External DV.net Checkout"]
```

## 7. Wireframes

### Composer collapsed / default

```text
+--------------------------------------------------------------------------------+
| [Mode: Исследовать v] [Улучшить prompt] [TDD Plan] [Проверить] [Разъебать] ... |
|--------------------------------------------------------------------------------|
|                                                                                |
|  Введите задачу, prompt, bug report, продуктовую идею или spec...              |
|                                                                                |
| [Files] [Sources] [Model] [cwd]                                      [Submit] |
+--------------------------------------------------------------------------------+
```

Rules:

- `Mode` is the behavior of the normal submit.
- Action buttons do not submit the session immediately.
- Action buttons open a generated in-app artifact screen based on the current prompt.
- Default mode becomes `research`.

### Prompt Lab screen

```text
+--------------------------------------------------------------------------------+
| Prompt Lab                                      [Back] [Replace Input] [Submit] |
|--------------------------------------------------------------------------------|
| Original prompt                         | Improved prompt                      |
|-----------------------------------------|--------------------------------------|
| raw text from composer                  | clarified role/objective/context     |
|                                         | constraints/deliverables/criteria    |
|--------------------------------------------------------------------------------|
| Diffs / assumptions / missing questions                                        |
| [Accept selected] [Send to TDD Plan] [Send to Spec] [Copy]                     |
+--------------------------------------------------------------------------------+
```

### TDD Plan screen

```text
+--------------------------------------------------------------------------------+
| TDD Plan                                      [Back] [Insert Plan] [Start TDD] |
|--------------------------------------------------------------------------------|
| Ticket / goal / mode / gates                                                   |
|--------------------------------------------------------------------------------|
| RED            | GREEN             | VERIFY              | WORKLOG             |
| write tests    | minimal impl      | gates/build         | evidence/matrix     |
| commands       | dependencies      | risks               | commit notes        |
|--------------------------------------------------------------------------------|
| Fake providers required: LLM / browser / S3 / billing / auth / team            |
+--------------------------------------------------------------------------------+
```

### Review Gate screen: Проверить / Разъебать tabs

```text
+--------------------------------------------------------------------------------+
| Review Gate                                   [Back] [Apply Notes] [Run Check] |
|--------------------------------------------------------------------------------|
| [Проверка] [Разъебать] [Риски] [Acceptance]                                    |
|--------------------------------------------------------------------------------|
| Проверка: factual/logic/security/test adequacy                                 |
| Разъебать: adversarial critique, contradictions, weak assumptions, missing AC   |
|--------------------------------------------------------------------------------|
| Finding | Severity | Evidence | Suggested fix                                  |
+--------------------------------------------------------------------------------+
```

### Account unauthenticated

```text
+--------------------------------------------------------------------------------+
| Account                                                                        |
|--------------------------------------------------------------------------------|
| [Вход] [Регистрация] [Сброс пароля]                                             |
|                                                                                |
| Email                                                                          |
| Password                                                                       |
| [Войти]                                                                        |
|                                                                                |
| No browser pane. Errors and session state render here.                         |
+--------------------------------------------------------------------------------+
```

### Account authenticated

```text
+--------------------------------------------------------------------------------+
| Account                                      [Profile] [Teams] [Storage] [Bill] |
|--------------------------------------------------------------------------------|
| Balance: 120.00 USDT        Active team: ROX Ops        S3: s3.max healthy     |
|--------------------------------------------------------------------------------|
| Profile: display name, email, sessions, logout                                 |
| Teams: create team, invites, members, roles                                    |
| Spaces: per-team workspaces, sessions, files, artifacts                        |
| Storage: user bucket, team buckets, quotas, usage                              |
| Billing: USDT ledger, top-up intent, DV.net external checkout                  |
+--------------------------------------------------------------------------------+
```

### Team spaces

```text
+--------------------------------------------------------------------------------+
| Team: ROX Ops                                            [Invite] [New Space] |
|--------------------------------------------------------------------------------|
| Members                         | Spaces                                      |
| owner/admin/member/viewer       | Default / Research / Client A / Release    |
| pending invites                 | prefix, quota, activity, last sync         |
|--------------------------------------------------------------------------------|
| Space detail: sessions, files, artifacts, storage prefix, audit events          |
+--------------------------------------------------------------------------------+
```

## 8. Sequence diagram

```mermaid
sequenceDiagram
  actor User
  participant Composer as Composer UI
  participant Workbench as Shared Workbench Policy
  participant AccountUI as Account UI
  participant AuthAPI as Account/Auth API
  participant TeamAPI as Team/Spaces API
  participant StorageAPI as Storage API
  participant S3 as S3 Adapter
  participant BillingAPI as Billing API
  participant DV as DV.net

  User->>Composer: Type prompt
  User->>Composer: Click action button
  Composer->>Workbench: Generate artifact from prompt
  Workbench-->>Composer: Prompt Lab / TDD Plan / Review Gate model
  Composer-->>User: Render in-app screen

  User->>Composer: Click Submit
  Composer->>Workbench: Resolve selected mode
  Workbench-->>Composer: Mode-specific request metadata
  Composer-->>User: Session submit continues

  User->>AccountUI: Open Account
  AccountUI->>AuthAPI: GET /api/account/me
  alt Unauthenticated
    AuthAPI-->>AccountUI: 401
    AccountUI-->>User: Native Вход/Регистрация/Сброс forms
  else Authenticated
    AuthAPI-->>AccountUI: profile/session
    AccountUI->>TeamAPI: GET /api/account/teams
    AccountUI->>StorageAPI: GET /api/account/storage
    StorageAPI->>S3: health/list usage via backend credentials
    AccountUI->>BillingAPI: GET /api/account/billing
    AccountUI-->>User: Profile/Teams/Spaces/Storage/Billing
  end

  User->>BillingAPI: POST /api/account/billing/top-up-intent
  BillingAPI-->>AccountUI: paymentUrl
  AccountUI->>DV: Open external checkout
  DV-->>BillingAPI: POST /api/webhooks/dvnet
  BillingAPI->>BillingAPI: Verify signature and idempotency
  BillingAPI-->>DV: { success: true }
```

Failure points:

- Empty prompt: action screens show inline empty state; no provider call.
- Rewrite/TDD/review policy error: show generated artifact error state; keep original prompt intact.
- Account 401: render native auth forms, not browserPane.
- Auth API unavailable: render retry/error state in account page.
- Team invite already used: server returns conflict; UI shows used invite state.
- Cross-team access: server returns 403; UI never receives foreign team space.
- S3 endpoint unavailable: storage page shows unhealthy backend status; no renderer credentials.
- DV.net checkout fails: intent remains pending/failed; no balance credit until confirmed webhook.
- Duplicate webhook: ignored by stored `tx_hash + bc_uniq_key` idempotency key.

## 9. Data-flow diagram

```mermaid
flowchart LR
  Prompt["Composer prompt"] --> Action["Action button"]
  Action --> Policy["Shared workbench policy"]
  Policy --> Artifact["In-app artifact screen"]
  Artifact --> Input["Replace composer input"]
  Artifact --> Session["Submit session with selected mode"]

  AuthForms["Native account forms"] --> AuthAPI["Auth API"]
  AuthAPI --> SessionCookie["Account session cookie"]
  SessionCookie --> AccountState["Account page state"]

  AccountState --> TeamAPI["Team/Spaces API"]
  TeamAPI --> TeamDB["rox_organizations + team tables"]
  TeamDB --> Spaces["Team spaces"]

  AccountState --> StorageAPI["Storage API"]
  StorageAPI --> BucketDB["storage bucket records"]
  StorageAPI --> S3["S3-compatible backend"]
  S3 --> StorageStatus["usage/quota/health DTO"]

  AccountState --> BillingAPI["Billing API"]
  BillingAPI --> TopupDB["billing top-up records"]
  BillingAPI --> PaymentUrl["DV.net checkout URL"]
  DVWebhook["DV.net webhook"] --> BillingAPI
  BillingAPI --> Ledger["USDT ledger"]
```

Checkpoints:

- Prompt artifacts are pure shared DTOs before UI rendering.
- Account auth forms call API directly and never create visible browser panes.
- Storage API converts team/user scope to bucket/prefix; renderer sees only DTOs.
- Billing API credits ledger only after verified, confirmed, idempotent DV.net webhook.

## 10. Options and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep native `<select>` mode control | Lowest diff | Looks generic, cramped, weak mobile affordance, mixes mode/action mentally | Reject |
| Segmented/pill mode control plus separate action buttons | Clear mental model, better scan, easy tests, better mobile wrap | Requires component/test updates | Choose |
| Keep prompt rewrite/TDD/review as dialogs | Minimal route work | Still feels cramped and not like product screens | Transitional only |
| Move action outputs to screens/sheets | Better artifact review, room for diffs/tabs/actions | More UI state and tests | Choose |
| Account via embedded browser pane | Reuses web account | Confusing, breaks app-local cabinet mental model | Reject |
| Native in-app account forms + internal account route | Clear UX, testable, no browser context leak | Requires API surface coverage | Choose |
| Buckets per space | Simple isolation | Many buckets, harder quotas/cleanup | Reject for MVP |
| Buckets per user/team, spaces as prefixes | Fewer buckets, clear owner boundary, easier quotas | Prefix policy must be strict | Choose |
| DV.net payment form URL | Fast and docs-supported | External checkout step | Choose for MVP |
| Full DV.net API wallet flow | More control | More secrets/API risk now | Later |

## 11. Recommended implementation path

### Phase A: Composer UX

1. Add tests for toolbar mode/action mapping:
   - default mode is `research`;
   - mode control is not a native select dependency;
   - actions include `Улучшить prompt`, `TDD Plan`, `Проверить`, `Разъебать`, `Собрать ТЗ`, `Ревью`;
   - action buttons emit artifact-screen intents and do not submit the session.
2. Replace `ProductModeToolbar` visual structure with mode pills plus action row.
3. Add screen/sheet state model:
   - `PromptLabScreen`
   - `TddPlanScreen`
   - `ReviewGateScreen`
4. Reuse existing shared engines:
   - prompt rewrite engine for `Улучшить prompt`;
   - TDD task generator for `TDD Plan`;
   - review board/validation gates for `Проверить` and `Разъебать`.

### Phase B: Embedded account UX

1. Add tests proving unauthenticated account flow renders native forms and does not call `browserPane.create`.
2. Remove visible login/register/account `browserPane` flow from `AccountSettingsPage`.
3. Add native tabs:
   - `Вход`
   - `Регистрация`
   - `Сброс пароля`
4. Keep external opening only for DV.net checkout URLs returned by backend top-up intents.

### Phase C: Teams and spaces

1. Preserve `/api/account/organizations` compatibility.
2. Add `/api/account/teams` aliases and `Team` DTOs.
3. Add team spaces:
   - `GET /api/account/teams/:teamId/spaces`
   - `POST /api/account/teams/:teamId/spaces`
4. Add invite create/accept once:
   - `POST /api/account/teams/:teamId/invites`
   - `POST /api/account/invites/:code/accept`
5. Add role matrix tests: owner/admin/member/viewer deny-by-default.

### Phase D: Storage and billing

1. Add backend S3 adapter config/health with fake adapter tests.
2. Create bucket records for user/team scopes; spaces map to prefixes.
3. Add `/api/account/storage`.
4. Add USDT billing DTOs and DV.net top-up intent creation.
5. Add `/api/webhooks/dvnet` with signature/idempotency tests before implementation.

## 12. Public interfaces / types

Add shared DTOs:

- `AccountTeam`
- `AccountTeamMember`
- `AccountTeamSpace`
- `AccountTeamInvite`
- `AccountStorageBucket`
- `AccountStorageUsage`
- `BillingBalance`
- `BillingTopUpIntent`
- `DvnetWebhookEvent`

Add backend tables:

- `rox_team_spaces`
- `rox_team_invites`
- `rox_storage_buckets`
- `rox_billing_topups`
- `rox_billing_ledger_entries`
- `rox_dvnet_webhook_events`

Add API routes:

- `GET /api/account/teams`
- `POST /api/account/teams`
- `GET /api/account/teams/:teamId/spaces`
- `POST /api/account/teams/:teamId/spaces`
- `POST /api/account/teams/:teamId/invites`
- `POST /api/account/invites/:code/accept`
- `GET /api/account/storage`
- `POST /api/account/billing/top-up-intent`
- `POST /api/webhooks/dvnet`

## 13. Tests added first

Implemented in slice A:

- `apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
  - default composer mode is `research`;
  - action order is `improve-prompt`, `run-tdd-plan`, `verify`, `tear-down`, `build-spec`, `review`;
  - actions map to artifact modes without submitting;
  - `tear-down` opens review mode;
  - `improve-prompt` uses `workbench.actions.improvePrompt`;
  - SSR markup uses a custom mode picker and no native `<select>`.
- `apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
  - prompt rewrite opens only from `improve-prompt`;
  - default rewrite target follows default `research` mode.
- `apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts`
  - legacy `think-with-me` flow remains covered without exposing it in the new toolbar action row.

Implemented in slice B:

- `apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx`
  - Prompt Lab empty state disables `Replace Input` and does not imply provider execution;
  - Prompt Lab error state renders inline error text;
  - Prompt Lab success state renders original prompt, improved prompt, and handoff actions;
  - TDD Plan renders RED/GREEN/VERIFY/WORKLOG phases and fake-provider requirements;
  - Review Gate renders `Проверка` and `Разъебать` tabs with review-board findings.

Implemented in slice C:

- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
  - `Улучшить prompt` routes to Prompt Lab and never submits directly;
  - empty prompt routes to Prompt Lab error state without provider execution;
  - `TDD Plan` routes to TDD Plan with red/green/verify/worklog phases;
  - `Проверить` routes to Review Gate in check mode;
  - `Разъебать` routes to Review Gate in adversarial mode;
  - `Собрать ТЗ` routes to the Spec Builder artifact.
- `apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx`
  - panel renders Prompt Lab, TDD Plan, and Review Gate artifacts;
  - panel renders nothing when no artifact is selected.

Implemented in slice D:

- `apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
  - unauthenticated account UX renders native `Вход`, `Регистрация`, and `Сброс пароля` tabs;
  - native auth markup does not contain `rox.one/login` or browser-navigation copy;
  - sign-in/register/reset map to `/api/auth/login`, `/api/auth/register`, and `/api/auth/password-reset/request`;
  - external account navigation allowlist accepts DV.net checkout URLs and rejects `rox.one/account`.

Implemented in slice E:

- `packages/server-core/src/webui/__tests__/account-teams.test.ts`
  - team spaces can be created only by owners/admins;
  - members/viewers can list their team's spaces;
  - outsiders are denied by default.
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
  - `/api/account/teams` aliases organization create/list;
  - `/api/account/teams/:teamId/spaces` creates/lists spaces with RBAC;
  - `/api/account/teams/:teamId/invites` creates role-scoped invites;
  - `/api/account/invites/:code/accept` accepts invites once;
  - viewer create and outsider read paths return `403`.

Implemented in slice F:

- `packages/server-core/src/storage/__tests__/object-storage.test.ts`
  - S3 endpoint preference tries `http://s3.max:9000` before `http://s3.rox:9000` with a fake health probe;
  - unhealthy storage status does not leak secrets, access keys, or credentials;
  - user and team bucket records use per-owner buckets, scoped prefixes, and default quotas;
  - team spaces map to validated prefixes inside the team bucket and reject traversal-like IDs.
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
  - `/api/account/storage` requires an account session;
  - authenticated storage status returns the current user's bucket DTO without renderer credentials.

Implemented in slice G:

- `packages/server-core/src/webui/__tests__/account-ledger.test.ts`
  - account ledger currency is `USDT`.
- `packages/server-core/src/webui/__tests__/account-cabinet.test.ts`
  - default account cabinet billing shows `USDT`.
- `packages/server-core/src/webui/__tests__/account-billing.test.ts`
  - DV.net top-up intent creates a payment form URL and exposes no secrets;
  - confirmed `PaymentReceived` webhook credits only once by `tx_hash:bc_uniq_key`;
  - invalid signatures are rejected;
  - unconfirmed events are acknowledged but not credited.
- `packages/server-core/src/webui/__tests__/account-http.test.ts`
  - configured `/api/account/billing/top-up-intent` returns a DV.net checkout URL and USDT billing;
  - `/api/webhooks/dvnet` verifies `x-dv-signature`, credits once, handles duplicates idempotently, and rejects invalid signatures.

Planned follow-up tests:

- Server account tests for login/register/account compatibility.
- Team API tests for create/list/invite/accept-once and role matrix denial.

## 14. Expected failing test output

First red run for slice A:

```text
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts

Expected: "research"
Received: "rewrite"

Expected action order:
["improve-prompt", "run-tdd-plan", "verify", "tear-down", "build-spec", "review"]
Received:
["rewrite-prompt", "think-with-me", "build-spec", "review", "verify", "run-tdd-plan", "save-preset"]

Unknown composer product mode action: improve-prompt
Expected markup to contain data-testid="product-mode-picker"
```

First red run for slice B:

```text
bun test apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx

error: Cannot find module '../PromptLabScreen'
0 pass
1 fail
1 error
```

First red runs for slice C:

```text
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts

error: Cannot find module '../composer-artifact-flow'
0 pass
1 fail
1 error
```

```text
bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx

error: Cannot find module '../ComposerArtifactPanel'
0 pass
1 fail
1 error
```

First build run after implementation exposed a package-boundary issue:

```text
bun run webui:build

Missing "./workbench/tdd-task-generator" specifier in "@craft-agent/shared" package
```

The fix was to import the TDD task generator from the existing `@craft-agent/shared/workbench` barrel instead of a deep package path.

First red run for slice D:

```text
bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx

error: Cannot find module '../AccountAuthPanel'
0 pass
1 fail
1 error
```

First red runs for slice E:

```text
bun test packages/server-core/src/webui/__tests__/account-teams.test.ts

TypeError: teams.createSpace is not a function
```

```text
bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "teams, spaces"

Expected: 200
Received: 404
```

First red runs for slice F:

```text
bun test packages/server-core/src/storage/__tests__/object-storage.test.ts

SyntaxError: Export named 'createTeamSpaceStoragePrefix' not found in module
0 pass
1 fail
1 error
```

```text
bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "protected cabinet defaults"

Expected: 200
Received: 404
```

First red runs for slice G:

```text
bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts packages/server-core/src/webui/__tests__/account-billing.test.ts

Cannot find module '../account-billing'
Expected: "USDT"
Received: "ROX"
```

```text
bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "DV.net"

Expected: "ready"
Received: "disabled"
```

## 15. Implementation changes

Slice A:

- Changed composer default product mode from `rewrite` to `research`.
- Replaced toolbar action row with the approved actions:
  - `Улучшить prompt`
  - `TDD Plan`
  - `Проверить`
  - `Разъебать`
  - `Собрать ТЗ`
  - `Ревью`
- Replaced the native `<select>` with a custom button/listbox mode picker.
- Renamed the prompt rewrite trigger to `improve-prompt` while reusing the existing rewrite flow.
- Preserved legacy Thinking Partner flow as an internal compatibility helper; it is no longer emitted by the toolbar action row.
- Added `workbench.actions.improvePrompt` and `workbench.actions.tearDown` across locale files and updated the Russian labels.

Slice B:

- Added `artifact-screen-state.ts` with state builders for Prompt Lab, TDD Plan, and Review Gate.
- Added `PromptLabScreen.tsx` with empty/error/success rendering and handoff controls.
- Added `TddPlanScreen.tsx` backed by the shared TDD task-pack generator.
- Added `ReviewGateScreen.tsx` backed by the shared review-board engine and validation gates.
- Kept the screens provider-free and deterministic; composer wiring remains a separate follow-up slice.

Slice C:

- Added `composer-artifact-flow.ts` as a pure intent-to-artifact resolver for composer action buttons.
- Added `ComposerArtifactPanel.tsx` to render Prompt Lab, TDD Plan, Review Gate, and Spec Builder as in-app composer artifacts.
- Wired `FreeFormInput.tsx` so approved action buttons open artifacts and return `shouldSubmit=false` instead of submitting the session.
- Added replacement handoff from Prompt Lab/TDD Plan back into the composer input.
- Marked artifact screen action buttons as `type="button"` so nested composer form submission cannot be triggered accidentally.
- Fixed TDD generator imports to use the shared workbench barrel and respect package exports.

Slice D:

- Added `AccountAuthPanel.tsx` with native in-app tabs for sign-in, registration, and password reset.
- Added a pure auth request mapper so the forms call account API endpoints directly.
- Added a DV.net-only external URL allowlist for account checkout escapes.
- Removed visible account browser-pane login/register/reset flows from `AccountSettingsPage.tsx`.
- Removed the hidden browser-pane API bridge from `AccountSettingsPage.tsx`; desktop account API calls now use direct fetch to `https://rox.one`.
- Changed billing top-up opening to use `window.electronAPI.openUrl` only after a DV.net checkout URL is returned and accepted by the allowlist.

Slice E:

- Extended `AccountTeamStore` with `AccountTeamSpace`, `createSpace`, and `listSpaces`.
- Implemented in-memory team spaces with storage prefixes under `teams/<teamId>/spaces/<spaceId>/`.
- Added owner/admin-only space creation and membership-required space listing.
- Added `/api/account/teams` aliases over the existing organization compatibility layer.
- Added `/api/account/teams/:teamId/spaces`, `/api/account/teams/:teamId/invites`, and `/api/account/invites/:code/accept`.
- Preserved existing `/api/account/organizations` and `/api/account/organizations/join` compatibility endpoints.

Slice F:

- Added backend-only S3-compatible storage endpoint preference policy with `s3.max` first and `s3.rox` fallback.
- Added user/team storage bucket records with per-owner bucket names, tenant prefixes, and existing 1 GiB/10 GiB default quotas.
- Added team-space storage prefixes under `teams/<teamId>/spaces/<spaceId>/` using the same tenant ID validation boundary.
- Added secret-free storage status DTOs; renderer-facing responses expose endpoint health, bucket, prefix, usage, and quota only.
- Added `GET /api/account/storage`, protected by account sessions, returning the user bucket and current team buckets when a team store is present.

Slice G:

- Changed server-core account ledger and account cabinet billing currency from `ROX` to `USDT`.
- Added `account-billing.ts` with DV.net payment-form intent generation, HMAC webhook signature verification, micro-USDT amount parsing, and `PaymentReceived` processing.
- Added configured `/api/account/billing/top-up-intent` behavior that returns a DV.net checkout URL only when server-side DV.net config and usage ledger are present.
- Added public `/api/webhooks/dvnet` handler that verifies `x-dv-signature`, credits only confirmed payments, and remains idempotent by `tx_hash:bc_uniq_key`.
- Updated account settings balance fallback to `USDT`.
- Updated persistent auth server defaults for new billing rows from `ROX` to `USDT`; existing rows are not mutated in this slice.

## 16. Validation commands run

Planning/discovery:

- `git status --short`
- `rg --files packages apps infra docs | rg '(ProductModeToolbar|AccountSettingsPage|account|team|organization|billing|storage|workbench|composer|prompt|review|T032|dv|s3)'`
- `rg -n "ProductModeToolbar|AccountSettingsPage|browserPane|organizations|rox_organizations|billing|storage|DV|dv.net|s3.max|S3" packages apps infra docs -S`
- `sed -n ... ProductModeToolbar.tsx`
- `sed -n ... product-mode-toolbar.ts`
- `sed -n ... FreeFormInput.tsx`
- `sed -n ... AccountSettingsPage.tsx`
- `sed -n ... account-teams.ts`

External docs checked:

- `https://docs.dv.net/en/integration/connecting-payment-form-without-api.html`
- `https://docs.dv.net/en/integration/webhooks.html`

Slice A:

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/thinking-partner-flow.test.ts`
- `bun run typecheck:electron`
- `bun run typecheck:shared`
- `bun run lint:i18n:parity`
- `bun run webui:build`
- `git diff --check`

Slice B:

- `bun test apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts`
- `bun run typecheck:electron`
- `bun run webui:build`
- `git diff --check`

Slice C:

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx`
- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-panel.test.tsx apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx apps/electron/src/renderer/components/workbench/__tests__/spec-builder-screen.test.tsx`
- `bun run typecheck:electron`
- `bun run webui:build`
- `git diff --check`

Slice D:

- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx apps/electron/src/renderer/pages/settings/__tests__/account-brand-summary.test.ts`
- `rg -n "browserPane|openAccount|ACCOUNT_LOGIN|ACCOUNT_SIGNUP|ACCOUNT_RESET|visibleAuth|bridgePane|ensureDesktopBridge|isRoxAccountUrl|readBridgeError|DesktopBridgeResponse" apps/electron/src/renderer/pages/settings/AccountSettingsPage.tsx apps/electron/src/renderer/pages/settings/AccountAuthPanel.tsx`
- `bun run typecheck:electron`
- `bun run webui:build`

Slice E:

- `bun test packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "teams, spaces"`
- `bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:all`
- `bun run webui:build`

Slice F:

- `bun test packages/server-core/src/storage/__tests__/object-storage.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "protected cabinet defaults"`
- `bun test packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "storage|protected cabinet defaults|cabinet data"`
- `bun test packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:all`
- `bun run webui:build`
- `git diff --check`

Slice G:

- `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts packages/server-core/src/webui/__tests__/account-billing.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "DV.net"`
- `bun test packages/server-core/src/webui/__tests__/account-billing.test.ts packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:electron`
- `bun run typecheck:all`
- `bun run webui:build`
- `node --check infra/rox-one-auth-server.mjs`
- `git diff --check`

Slice H:

- `bun test packages/server-core/src/webui/__tests__/account-billing.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "DV.net|billing and DV.net"`
- `bun test packages/server-core/src/webui/__tests__/account-billing.test.ts packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts packages/server-core/src/storage/__tests__/object-storage.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx apps/electron/src/renderer/pages/settings/__tests__/account-storage-summary.test.ts`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:electron`
- `bun run typecheck:all`
- `bun run webui:build`
- `git diff --check`

Slice I:

- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-teams-summary.test.ts`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-teams-summary.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-storage-summary.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `bun test packages/server-core/src/webui/__tests__/account-teams.test.ts packages/server-core/src/webui/__tests__/account-http.test.ts --test-name-pattern "teams, spaces|account organizations|joins account organizations|protected cabinet defaults"`
- `bun run typecheck:electron`
- `bun run webui:build`
- `git diff --check`

Slice J:

- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-teams-summary.test.ts`
- `bun test apps/electron/src/renderer/pages/settings/__tests__/account-teams-summary.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-storage-summary.test.ts apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx`
- `bun run typecheck:electron`
- `bun run webui:build`

Slice K:

- `bun test infra/__tests__/rox-one-auth-server-contract.test.ts`
- `node --check infra/rox-one-auth-server.mjs`

## 17. Passing test output summary

- Slice A targeted tests: `17 pass`, `0 fail`, `63 expect() calls`.
- `bun run typecheck:electron`: passed after widening the legacy Thinking Partner helper input.
- `bun run typecheck:shared`: passed.
- `bun run lint:i18n:parity`: `i18n parity OK (7 locales, 1425 keys each)`.
- `git diff --check`: passed with no whitespace errors.
- Slice B targeted workbench tests: `4 pass`, `0 fail`, `27 expect() calls`.
- Slice B relevant renderer tests: `16 pass`, `0 fail`, `92 expect() calls`.
- Slice B `bun run typecheck:electron`: passed.
- Slice C artifact routing tests: `11 pass`, `0 fail`, `51 expect() calls`.
- Slice C broader relevant renderer tests: `28 pass`, `0 fail`, `127 expect() calls`.
- Slice C `bun run typecheck:electron`: passed.
- Slice C `git diff --check`: passed.
- Slice D account tests: `5 pass`, `0 fail`, `16 expect() calls`.
- Slice D browser-pane grep: no matches in account page/panel.
- Slice D `bun run typecheck:electron`: passed.
- Slice E team/http tests: `20 pass`, `0 fail`, `115 expect() calls`.
- Slice E server-core `tsc --noEmit`: passed.
- Slice E `bun run typecheck:all`: passed.
- Slice F storage tests: `8 pass`, `0 fail`, `34 expect() calls`.
- Slice F storage/account focused tests: `10 pass`, `0 fail`, `54 expect() calls`.
- Slice F broader server/storage/team tests: `28 pass`, `0 fail`, `156 expect() calls`.
- Slice F server-core `tsc --noEmit`: passed.
- Slice F `bun run typecheck:all`: passed.
- Slice G account billing/ledger/cabinet/http/UI targeted tests: `31 pass`, `0 fail`, `158 expect() calls`.
- Slice G server-core `tsc --noEmit`: passed.
- Slice G `bun run typecheck:electron`: passed.
- Slice G `bun run typecheck:all`: passed.
- Slice G `node --check infra/rox-one-auth-server.mjs`: passed.
- Slice H DV.net focused tests: `5 pass`, `0 fail`, `26 expect() calls`.
- Slice H broader account/storage/UI tests: `42 pass`, `0 fail`, `204 expect() calls`.
- Slice H server-core `tsc --noEmit`: passed.
- Slice H `bun run typecheck:electron`: passed.
- Slice H `bun run typecheck:all`: passed.
- Slice H `git diff --check`: passed.
- Slice I expected failure: `Cannot find module '../account-teams-summary'` before implementation.
- Slice I account teams summary tests: `3 pass`, `0 fail`, `8 expect() calls`.
- Slice I account UI focused tests: `9 pass`, `0 fail`, `31 expect() calls`.
- Slice I backend team/http regression tests: `4 pass`, `0 fail`, `35 expect() calls`.
- Slice I `bun run typecheck:electron`: passed.
- Slice I `git diff --check`: passed.
- Slice J expected failure: `Export named 'getManageableTeamOptions' not found` before implementation.
- Slice J focused account UI tests: `10 pass`, `0 fail`, `32 expect() calls`.
- Slice J `bun run typecheck:electron`: passed.
- Slice K expected failure: hosted auth contract test failed on missing `rox_team_spaces`, `rox_team_invites`, team-first routes, storage route, and invite accept route.
- Slice K hosted auth contract tests: `3 pass`, `0 fail`, `11 expect() calls`.
- Slice K `node --check infra/rox-one-auth-server.mjs`: passed.

## 18. Build output summary

- `bun run webui:build` passed; Vite built the renderer bundle in `23.35s`.
- Warnings only: outDir warning, deprecated Jotai Babel plugin notices, and existing large chunk warnings.
- Slice B `bun run webui:build` passed; Vite built the renderer bundle in `22.75s`.
- Slice C `bun run webui:build` initially failed on a deep shared package import, then passed after switching to the exported workbench barrel; Vite built the renderer bundle in `23.95s`.
- Slice D `bun run webui:build` passed; Vite built the renderer bundle in `29.58s`.
- Slice E `bun run webui:build` passed; Vite built the renderer bundle in `26.61s`.
- Slice F `bun run webui:build` passed; Vite built the renderer bundle in `26.62s`; warnings only: existing outDir, deprecated Jotai Babel plugin, and large chunk warnings.
- Slice G `bun run webui:build` passed; Vite built the renderer bundle in `26.26s`; warnings only: existing outDir, deprecated Jotai Babel plugin, and large chunk warnings.
- Slice H `bun run webui:build` passed; Vite built the renderer bundle in `26.64s`; warnings only: existing outDir, deprecated Jotai Babel plugin, and large chunk warnings.
- Slice I `bun run webui:build` passed; Vite built the renderer bundle in `24.11s`; warnings only: existing outDir, deprecated Jotai Babel plugin, and large chunk warnings.
- Slice J `bun run webui:build` passed; Vite built the renderer bundle in `23.82s`; warnings only: existing outDir, deprecated Jotai Babel plugin, and large chunk warnings.
- Slice K has no renderer build impact; syntax validation passed with `node --check`.

## 19. Remaining risks

- The current account page likely has hidden browser pane coupling even after visible auth panes are removed; the API client boundary should be extracted and tested.
- DV.net signature verification details require opening the official signature verification page before coding.
- The app currently uses `localhost`/`127.0.0.1` exceptions in packaged Info.plist; this plan does not change that.
- S3 endpoint reachability (`s3.max` vs `s3.rox`) is modeled through a backend health boundary with fake tests; live network provisioning is still pending.
- `Разъебать` is an explicit product label requested by the user; localization and enterprise builds may need a softer alias later.
- Prompt Lab, TDD Plan, Review Gate, and Spec Builder are now reachable from composer action buttons, but browser visual smoke is still pending.
- Desktop account fetch now goes directly to `https://rox.one`; live cookie/CORS behavior still needs packaged-app smoke testing against the real account service.
- Teams/spaces are implemented in the in-memory server-core store and HTTP handler; persistent SQL backing in `infra/rox-one-auth-server.mjs` remains pending.
- Storage bucket/status implementation is present for backend/account DTOs; real S3 SDK provisioning and persistent bucket records remain pending.
- Billing implementation now covers USDT ledger/cabinet defaults, DV.net checkout intent, official `X-SIGN` signature verification, intent-resolved confirmed-only crediting, duplicate webhook idempotency, and a 64 KiB webhook body cap.
- Real DV.net deployment secrets and live webhook delivery remain untested and must stay server-side.
- The account storage panel exposes authenticated bucket/prefix topology for operator visibility, but no S3 credentials or secret material.
- DV.net webhook hardening currently covers signature, idempotency, intent resolution, status checks, and body size; network/IP rate limiting remains outside this slice.
- Teams/Spaces UI now uses team-first endpoints and readable team pickers for owner/admin actions.
- Hosted auth script now declares durable `rox_team_spaces`, `rox_team_invites`, and `rox_storage_buckets` tables and exposes team-first aliases, spaces, invites, invite acceptance, and account storage endpoints.
- Hosted auth coverage is currently a static contract test plus syntax check because `infra/rox-one-auth-server.mjs` starts the server at module top level and is not yet importable as an HTTP harness.
- Existing hosted auth DB rows that already contain `ROX` are not migrated automatically by this slice.
- Existing unrelated dirty files remain excluded from this task commit: `apps/electron/src/main/index.ts`, `events.jsonl`, and auto-update files.

## 20. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Composer mode and action concepts are separated | Pass | Slice A replaces native select with custom picker and separate action row |
| New action buttons are defined | Pass | Toolbar tests assert `improve-prompt`, `run-tdd-plan`, `verify`, `tear-down`, `build-spec`, `review`; RU labels include requested text |
| Prompt Lab screen is specified | Planned | Prompt Lab wireframe |
| TDD Plan screen is specified | Planned | TDD Plan wireframe |
| Review Gate screen is specified | Planned | Review Gate wireframe |
| Prompt Lab renders empty/error/success states | Pass | Slice B artifact-screen tests |
| TDD Plan renders task-pack phases | Pass | Slice B artifact-screen tests |
| Review Gate renders check and adversarial review state | Pass | Slice B artifact-screen tests |
| Composer action buttons open in-app artifact screens | Pass | Slice C `composer-artifact-flow` and `composer-artifact-panel` tests |
| Composer action buttons do not submit directly | Pass | Slice C resolver returns `shouldSubmit=false`; artifact buttons are `type="button"` |
| Account auth is in-app, not browser-pane based | Pass | Slice D native account panel tests and no account `browserPane` grep matches |
| External account navigation is limited to DV.net checkout | Pass | Slice D `isAllowedAccountExternalUrl` tests |
| Teams and collaborative spaces are specified | Pass | Slice E team/spaces/invites API and RBAC tests |
| S3 storage boundary is backend-only | Pass | Slice F backend-only endpoint preference, bucket records, `/api/account/storage`, and secret-free DTO tests |
| USDT/DV.net billing boundary is implemented with fake-provider tests | Pass | Slice G account-billing and account-http tests cover USDT, top-up intent, signature rejection, confirmed-only credit, and duplicate idempotency |
| DV.net webhook follows official signature and opaque intent boundary | Pass | Slice H uses `X-SIGN`, `sha256(rawJson + secret)`, server-side billing intents, and oversize webhook rejection tests |
| Account storage UX remains in-app and secret-free | Pass | Slice H account storage summary tests and account page storage section |
| Teams/Spaces UI uses team-first endpoints | Pass | Slice I tests assert `/api/account/teams`, `/spaces`, `/invites`, and `/invites/:code/accept` path mapping plus account page integration |
| Teams/Spaces controls avoid raw team-id UX | Pass | Slice J readable manageable-team option tests and account page Select controls |
| Hosted auth server exposes T032 team/storage compatibility | Pass | Slice K contract test asserts SQL tables and route contracts; `node --check` passes |
| TDD-first implementation plan exists | Planned | Phase A-D test-first path |
