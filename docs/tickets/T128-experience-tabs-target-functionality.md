# T128 - Experience tabs target functionality document

Status: complete

## Context

The `Опыт` section now has six tabs and visible demo content, but the intended
button behavior, user flow, data flow, and UX contract need one canonical
document so future implementation and QA do not drift.

## Goal

Document the target functionality of every button and major control inside the
six `Опыт` tabs:

- Долгие миссии
- Арена агентов
- Центр миссий
- Прогресс
- Карта квестов
- Кузница агентов

## Required UI

- Document shared demo console buttons.
- Document per-tab controls and expected user-visible outcomes.
- Distinguish enabled, disabled, blocked, local-demo, and runtime-backed states.

## Required Data/API

- Explain the data flow from sanitized session/demo sources into
  `ExperienceTruthState`, tab projections, evidence, ledger, quest, package,
  runtime, and MCP preset consumers.

## Required Automations

- Build and smoke the Electron app.
- Record validation evidence in the worklog.

## Acceptance Criteria

- [x] Target functionality document exists under `docs/product/`.
- [x] Document covers every `Опыт` tab and shared demo buttons.
- [x] Document includes user flow, data flow, UX, functions, and tradeoffs.
- [x] Electron build passes.
- [x] Electron app launches locally.
- [x] Worklog complete.
- [x] Commit created and pushed.
