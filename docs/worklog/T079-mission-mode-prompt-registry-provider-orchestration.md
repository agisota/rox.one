# T079 - Mission Mode Prompt Registry + Provider Orchestration

## 1. Task summary

Добавить реальные prompt/runtime contracts для mission modes и связать их с fake-safe provider gateway, чтобы режимы миссий перестали быть только UI-labels.

## 2. Repo context discovered

- `packages/shared/src/workbench/product-mode-registry.ts` покрывает composer product modes, но не Experience `MissionMode`.
- `packages/shared/src/workbench/experience-layer.ts` уже содержит `MissionModeSchema` с требуемыми режимами.
- `packages/server-core/src/provider-gateway/provider-gateway.ts` уже содержит fake/real adapter seam, timeout/error taxonomy, artifact validation, real-provider disable и public-share redaction.
- В provider gateway tests уже были проверки deterministic fake provider, invalid output, timeout, redaction and real-provider blocking; T079 дополняет их compiled mission-mode prompt execution.

## 3. Files inspected

- `packages/shared/src/workbench/experience-layer.ts`
- `packages/shared/src/workbench/product-mode-registry.ts`
- `packages/shared/src/workbench/index.ts`
- `packages/server-core/src/provider-gateway/provider-gateway.ts`
- `packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
- `packages/server-core/src/provider-gateway/index.ts`

## 4. Tests added first

- Shared test requiring all seven mission modes to have prompt/runtime contracts with role, objective, input/output contracts, required artifacts, validation gates, checkpoint behavior, provider capabilities, and failure modes.
- Shared test requiring deterministic prompt compilation from mission draft input.
- Provider gateway test requiring compiled `swarm_arena` prompt execution through the deterministic fake provider.

## 5. Expected failing test output

Red run:

```text
Cannot find module '../mission-mode-prompt-registry'
Export named 'compileMissionModePrompt' not found in module .../workbench/index.ts
```

## 6. Implementation changes

- Added `packages/shared/src/workbench/mission-mode-prompt-registry.ts`.
- Defined prompt/runtime contracts for:
  - `deep_run`
  - `deep_reasoning_lab`
  - `agenda_carnage`
  - `swarm_arena`
  - `round_table`
  - `autoresearch_loop`
  - `proactive_watchtower`
- Each contract declares role, objective, input contract, output contract, required artifacts, validation gates, checkpoint behavior, provider capabilities, and failure modes.
- Added deterministic `compileMissionModePrompt()` helper for mission draft inputs.
- Exported the registry through the shared workbench barrel.
- Added provider gateway test proving compiled mission mode prompts execute through deterministic fake provider without real provider calls.

## 7. Validation commands run

- `bun test packages/shared/src/workbench/__tests__/mission-mode-prompt-registry.test.ts packages/server-core/src/provider-gateway/__tests__/provider-gateway.test.ts`
- `bun test packages/shared/src/workbench packages/server-core/src/provider-gateway`
- `bun run typecheck:all`
- `bun run validate:docs`
- `bun run lint`
- `bun run electron:build`
- `git diff --check`

## 8. Passing test output summary

- Targeted T079 tests: `9 pass`, `0 fail`, `89 expect() calls`.
- Shared workbench + provider gateway subset: `116 pass`, `0 fail`, `1 snapshots`, `654 expect() calls`.
- `bun run typecheck:all`: pass.

## 9. Build output summary

- `bun run validate:docs`: pass, including agent contract, architecture docs, and sync design validation.
- `bun run lint`: pass with three pre-existing React hook dependency warnings outside T079 scope.
- `bun run electron:build`: pass with pre-existing renderer chunk-size warnings.
- `git diff --check`: pass.

## 10. Remaining risks

- Runtime mission launch still needs a UI dispatch path that passes the compiled prompt contract into provider execution for every mode; the fake-safe seam and contracts now exist for T080/T082 integration.
- Contract prompt templates are deterministic text contracts, not production prompt tuning; provider-specific prompt optimization should happen behind the provider adapter seam.
- Public/share redaction remains enforced in provider gateway tests; T084 will add the explicit share provider contract.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
| --- | --- | --- |
| Each mission mode has a prompt contract | Pass | `MissionModePromptRegistry` test |
| Prompt contract compiles with mission draft | Pass | `compileMissionModePrompt` test |
| Fake provider returns deterministic artifact | Pass | Provider gateway compiled prompt test |
| Malformed provider output fails gate | Pass | Existing provider gateway invalid artifact test |
| Provider timeout does not corrupt mission state | Pass | Existing provider timeout test |
| Secret fields are redacted from public/share artifacts | Pass | Existing provider redaction test |
| No real provider calls in tests | Pass | Existing real-provider disabled test plus fake gateway usage |
| Worklog complete | Pass | This file |
| Commit exists | Pass | Scoped Lore commit for T079 |
