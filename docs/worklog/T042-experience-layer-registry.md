# T042 - Experience Layer Registry

## Task summary

Add a shared registry for the Command/Game/Arena presentation layers and policy-based layer visibility.

## Reformulated task

Build the registry that later UI screens can use to render layer toggles while preserving the single T041 truth model.

The registry must prove:

- every layer has stable labels and feature flags
- Command is always available
- Game/Arena can be disabled by enterprise/team policy
- switching presentation layer preserves mission ids, artifact ids, gate ids, and ledger row ids

## Assumptions and boundaries

- This is still shared core work, not UI.
- Registry labels are stable identifiers, not final copy/i18n.
- Policy may hide Game/Arena, but cannot alter shared mission truth.
- Paid entitlements are not part of this ticket.

## ERD / schema view

```text
ExperienceLayerRegistryEntry
  layer -> labelKey + descriptionKey + featureFlags + defaultEnabled

ExperienceLayerPolicy
  commandEnabled(always true) + gameEnabled + arenaEnabled + disabledReasons

ExperienceLayerSwitchProjection
  fromLayer/toLayer -> truth ids + mutable flags false
```

## Sequence diagram

```text
UI asks for available layers
  -> registry resolves policy
  -> command is always returned
  -> game/arena returned only when policy allows
User toggles layer
  -> registry projects layer switch
  -> mission truth ids stay unchanged
  -> validation/ledger/artifact semantics stay immutable
```

## Component / screen map impact

Later screens consuming this registry:

- Composer Command/Game/Arena toggle
- Deep Missions layer selection
- Progression Observatory layer toggle
- Quest Map language switch
- Arena Builder availability

## Options and tradeoffs

1. Hardcode layer buttons in UI.
   - Rejected because enterprise policy and feature visibility would duplicate across screens.
2. Put layer visibility in shared registry.
   - Chosen because all screens can consume one deterministic policy result.

## Recommended path

Add `packages/shared/src/workbench/experience-layer-registry.ts`, targeted tests, and barrel export.

## Repo context discovered

- T041 added `experience-layer.ts` with shared truth projection helper.
- Existing workbench registries are pure modules with deterministic tests.
- The shared workbench barrel exports feature modules from `packages/shared/src/workbench/index.ts`.

## Files inspected

- `docs/product/experience-layer-system-prd.md`
- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/shared/src/workbench/__tests__/product-mode-registry.test.ts`
- `packages/shared/src/workbench/__tests__/experience-layer.test.ts`

## Tests added first

- `packages/shared/src/workbench/__tests__/experience-layer-registry.test.ts`
  - validates registry entries for all three layers
  - validates enterprise policy can disable Game/Arena
  - validates full policy exposes Command/Game/Arena
  - validates layer switching preserves mission/artifact/gate/ledger truth
  - validates blocked layer switch still keeps truth unchanged

## Expected failing test output

`bun test packages/shared/src/workbench/__tests__/experience-layer-registry.test.ts` initially failed as expected:

```text
error: Cannot find module '../experience-layer-registry'
0 pass
1 fail
```

After adding the module, the first implementation run also caught a Zod v4 API issue:

```text
TypeError: z.record(...).partial is not a function
```

The implementation was corrected to use `z.partialRecord(...)`.

## Implementation changes

- Added `packages/shared/src/workbench/experience-layer-registry.ts`.
- Added registry entries for `command`, `game`, and `arena`.
- Added layer feature flags.
- Added `resolveExperienceLayerPolicy`.
- Added `getAvailableExperienceLayers`.
- Added `projectExperienceLayerSwitch`.
- Exported the module from `packages/shared/src/workbench/index.ts`.

## Validation commands run

- `bun test packages/shared/src/workbench/__tests__/experience-layer-registry.test.ts` - pass
- `bun test packages/shared/src/workbench/__tests__/experience-layer.test.ts` - pass
- `bun run typecheck:shared` - pass
- `bun run validate:agent-contract` - pass
- `bun run lint:shared` - pass

## Passing test output summary

- T042 targeted test: 5 pass, 0 fail, 27 assertions.
- T041 regression test: 7 pass, 0 fail, 46 assertions.
- Shared typecheck: passed.
- Agent contract validation: `[agent-contract] ok: 11 skills, 42 tickets, 7 required docs`.
- Shared lint: passed.

## Build output summary

No runtime/build surfaces changed in T042. Build was not run.

## Remaining risks

- Root `bun run lint` and full `packages/shared bun test` have unrelated existing failures documented in T041 worklog.
- T042 does not add UI/i18n strings yet; registry exposes stable label keys for later UI tickets.

## Acceptance criteria matrix

- [x] Every layer has labels and feature flags.
- [x] Command layer is always available.
- [x] Enterprise policy can disable Game/Arena.
- [x] Toggle projection preserves mission ids, artifacts, gates, and ledger rows.
- [x] Targeted tests pass.
- [x] Relevant broader validation passes.
- [ ] Scoped commit exists.
