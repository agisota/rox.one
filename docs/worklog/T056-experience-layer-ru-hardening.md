# T056 — Experience Layer RU hardening

## 1. Task Summary
Second-pass localization hardening for the Experience Layer after T055. The goal is to remove visible English scaffolding from metric labels, checkpoint summaries, package registry copy, and game/arena microcopy without changing canonical state models.

## 2. Repo Context Discovered
- T055 introduced `experience-ui.tsx` and moved the six Experience screens onto reusable panels/cards/chips.
- A fresh `rg` pass still found visible English fragments in Mission Control, Arena, Progression, and Agent Forge.
- Some English terms remain acceptable only when they are canonical product nouns; this task targets accidental scaffolding strings.

## 3. Files Inspected
- `apps/electron/src/renderer/components/workbench/MissionControlRunDetail.tsx`
- `apps/electron/src/renderer/components/workbench/ArenaBuilderScreen.tsx`
- `apps/electron/src/renderer/components/workbench/ProgressionObservatory.tsx`
- `apps/electron/src/renderer/components/workbench/AgentForgeTeamRegistry.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx`
- `apps/electron/src/renderer/components/workbench/__tests__/mission-control-run-detail.test.tsx`

## 4. Tests Added First
- Added `experience microcopy does not leak English scaffolding in visible cards` to `experience-screens-localization.test.tsx`.
- The test renders Arena Builder, Mission Control, Progression Observatory, and Agent Forge together and asserts the visible cards contain RU-first labels for VDI deltas, checkpoint summaries, credits, trust floor, required gates, levels, trust score, and prompt-injection publishing guardrails.
- The same test rejects stale English scaffolding such as `VDI delta`, ` summary`, `Credits`, `Trust floor`, `Required gates`, `level `, `trust 80`, `Trust score`, `Prompt injection scan`, `public publish`, `team/private registry checks`, `Team-private`, and `tenants`.

## 5. Expected Failing Test Output
- Initial red run:
  - Command: `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx`
  - Expected failure: the new test failed because Mission Control still rendered `VDI delta` instead of `дельта VDI`, and adjacent screens still leaked English scaffolding.
- Full workbench regression red after implementation:
  - Command: `bun test apps/electron/src/renderer/components/workbench`
  - Expected failure: `Mission Control run detail > interim artifacts render by checkpoint` still expected the previous `12ч evidence memo` text after the UI was hardened to `12ч мемо доказательств`.

## 6. Implementation Changes
- `MissionControlRunDetail.tsx`
  - Localized checkpoint panel subtitle, card metadata, checkpoint summaries, interim artifact titles, audit summaries, billing labels, and critical gate blocker copy.
  - Preserved canonical checkpoint IDs such as `cp-6h` and gate IDs such as `security_check`.
- `ArenaBuilderScreen.tsx`
  - Localized budget labels (`Кредиты`, `Минимум доверия`, `Обязательные гейты`), selected-agent metadata, level labels, roster stats, locked-agent criteria, and selection warnings.
  - Added small localizers for package descriptions and unlock criteria without mutating the underlying package state.
- `ProgressionObservatory.tsx`
  - Localized economy subtitle, integrity rules, VDI evidence label, VDI progress label, capacity detail, and ledger reasons.
- `AgentForgeTeamRegistry.tsx`
  - Localized registry guardrails, trust score labels, publishing blocker copy, package metadata, and package descriptions while preserving trust/contract semantics.
- `mission-control-run-detail.test.tsx`
  - Updated the interim artifact assertion to the new localized text.
- Deslop pass:
  - Scope: the six T056 source/test files plus this ticket/worklog.
  - Result: no additional cleanup edit. Helpers are small, scoped, and covered; broader abstraction would add indirection without reducing risk.

## 7. Validation Commands Run
- `bun test apps/electron/src/renderer/components/workbench/__tests__/experience-screens-localization.test.tsx`
- `bun test apps/electron/src/renderer/components/workbench`
- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:agent-contract`
- `bun run electron:build`
- `bun run electron:smoke`
- `git diff --check -- <T056 scoped files>`
- LSP diagnostics through `omx_code_intel` for:
  - `MissionControlRunDetail.tsx`
  - `ArenaBuilderScreen.tsx`
  - `ProgressionObservatory.tsx`
  - `AgentForgeTeamRegistry.tsx`

## 8. Passing Test Output Summary
- Targeted localization test:
  - 2 pass, 0 fail, 44 expect calls.
- Full workbench component suite:
  - 46 pass, 0 fail, 222 expect calls across 11 files.
- `typecheck:electron`:
  - `tsc --noEmit` exited 0.
- `lint:electron`:
  - `eslint src/` exited 0.
- `validate:agent-contract`:
  - `[agent-contract] ok: 11 skills, 45 tickets, 7 required docs`.
- LSP diagnostics:
  - 0 diagnostics for all four changed TSX component files.
- `git diff --check`:
  - exited 0 for the scoped T056 files.

## 9. Build Output Summary
- `bun run electron:build` exited 0.
- Main/preload/renderer/resources/assets builds completed and verified.
- Existing toolchain warnings remained:
  - Vite `outDir` warning for renderer dist location.
  - Deprecated Jotai Babel plugin warnings.
  - Large chunk size warnings.
- `bun run electron:smoke` exited 0 outside sandbox:
  - Electron startup reached `App initialized successfully`.
  - Smoke exited via `Exit-on-ready requested`.
  - Final line: `[smoke] Electron headless startup passed`.

## 10. Remaining Risks
- This is a visible-copy hardening task only. It intentionally does not rename canonical state fields, IDs, permission terms, or persisted package data.
- Terms such as `VDI`, `swarm`, and `prompt-injection` remain visible where they function as product/technical nouns.
- Pixel-diff visual verification was not run because the current repo surface has deterministic component/build/smoke checks but no exposed visual-verdict command for these screens.
- Runtime files from app startup remain dirty and unstaged (`events.jsonl`, `.e2e-logs/`, `.superpowers/`), along with unrelated main-process auto-update files already present in the worktree.

## 11. Acceptance Criteria Matrix
| Criterion | Status | Evidence |
|---|---:|---|
| Mission Control metadata/summaries localized | Done | New localization test rejects `VDI delta`, ` summary`; Mission Control regression expects `12ч мемо доказательств` |
| Arena budget/roster microcopy localized | Done | New localization test requires `Кредиты`, `Минимум доверия`, `Обязательные гейты`, `уровень`, `доверие 80` |
| Progression capacity copy localized | Done | New localization test requires `Емкость, не качество.` and rejects `Capacity, не качество.` |
| Agent Forge registry/trust copy localized | Done | New localization test requires `Оценка доверия`, `Проверка prompt-injection`, `блокирует публичную публикацию` |
| Tests/typecheck/lint/build/run evidence | Done | Workbench 46 pass; typecheck/lint/agent-contract/build/smoke pass; LSP diagnostics 0 |
