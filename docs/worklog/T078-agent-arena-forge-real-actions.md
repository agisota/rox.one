# T078 - Agent Arena + Agent Forge Real Actions

## 1. Task summary

Связать `Арена агентов` и `Кузница агентов` с общим Experience runtime: установка/форк пакетов должны проходить через evidence-backed events, а Arena roster и mastery должны выводиться из runtime truth и ledger.

## 2. Repo context discovered

- `agent-forge-state.ts` уже содержит локальные guards: пакет без `SkillContract` нельзя установить, prompt-injection warning блокирует public publish, team/private visibility проверяется.
- `arena-builder-state.ts` уже валидирует locked agents, entitlement slots, budget estimate и draft payload, но runtime-projection использовала `trustScore` как статичный `masteryPercent`.
- `experience-runtime-store.ts` принимал `agent.package.installed` без evidence и сразу добавлял пакет в installed truth.
- T077 уже добавил quest nodes для install/fork, но без T078 reducer guard пакет мог попасть в truth без доверенного контракта.

## 3. Files inspected

- `apps/electron/src/renderer/components/workbench/agent-forge-state.ts`
- `apps/electron/src/renderer/components/workbench/arena-builder-state.ts`
- `apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx`
- `packages/shared/src/workbench/experience-runtime-store.ts`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts`

## 4. Tests added first

- Shared runtime test requiring `agent.package.installed` and `agent.package.forked` to carry trust evidence before mutating package truth.
- Arena renderer/state test requiring installed runtime packages to appear in roster and verified usage mastery ledger to increase `masteryPercent`.

## 5. Expected failing test output

Red run:

```text
Expected to not contain: "pkg-team-critic"
Received: [ "pkg-team-critic" ]

Expected: 92
Received: 80
```

## 6. Implementation changes

- Added runtime guard for `agent.package.installed`: requires both gate and artifact trust evidence plus trusted package risk/score before adding to `installedAgentPackageIds`.
- Added runtime guard for `agent.package.forked`: requires evidence and trusted package risk/score before adding forked package truth.
- Added warning notifications for ignored install/fork events so UI feedback is explicit without mutating truth.
- Updated Arena runtime projection to calculate `masteryPercent` from package `trustScore` plus verified `mastery` ledger entries tied to package usage evidence.
- Preserved existing Forge local guards for contracts, prompt-injection warnings, public publish checks, and tenant visibility.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-runtime-store.test.ts apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx`
- `bun test packages/shared/src/workbench apps/electron/src/renderer/components/workbench/__tests__/arena-builder-screen.test.tsx apps/electron/src/renderer/components/workbench/__tests__/agent-forge-team-registry.test.tsx`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted T078 tests: `12 pass`, `0 fail`, `60 expect() calls`.
- Relevant shared/Arena/Forge subset: `120 pass`, `0 fail`, `1 snapshots`, `615 expect() calls`.
- `typecheck:all`: passed.

## 9. Build output summary

- `validate:docs`: passed.
- `lint`: passed with existing React hook warnings in `App.tsx` and `FreeFormInput.tsx`; no lint errors.
- `electron:build`: passed. Existing renderer chunk-size warnings remain non-fatal.
- `git diff --check`: passed.

## 10. Remaining risks

- Forge UI still exposes install/fork as state helpers rather than dispatching runtime events from interactive client handlers; T080/T082 should wire cross-app action feedback.
- Public marketplace production adapter remains intentionally absent until T084/T086 guardrails and share/security work.
- Mastery evidence currently recognizes package-specific `artifact:<packageId>:usage` and `gate:<packageId>:verified-usage` refs; future provider runs should emit those refs consistently.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Package without contract/trust evidence cannot install | Pass | Runtime test rejects install without evidence; Forge contract test already passes |
| Prompt-injection warning blocks public publish | Pass | Existing Forge test remains part of relevant subset |
| Team-private package hidden cross-tenant | Pass | Existing Forge test remains part of relevant subset |
| Installed agent appears in Arena roster | Pass | Arena runtime projection test |
| Locked agent cannot join mission | Pass | Existing Arena test |
| Verified usage increases mastery | Pass | Arena runtime ledger test |
| Arena draft includes selected agents and gates | Pass | Existing Arena test |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T078 |
