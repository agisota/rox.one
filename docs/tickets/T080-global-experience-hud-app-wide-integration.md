# T080 - Global Experience HUD + App-Wide Integration

Status: DONE

## Goal

Expose Experience truth as a compact product-wide HUD and connect core composer artifact actions to typed Experience events.

## Scope

- Compact global HUD for VDI, readiness, active mission, next quest, blockers, XP/level, and latest notification.
- Runtime-derived HUD state from `ExperienceRuntimeStore` state.
- Command/Game/Arena presentation keeps the same truth values.
- Composer artifact actions emit typed Experience events for Prompt Lab, Spec Builder, TDD Plan, and Review Gate.
- Main content panels render the HUD above app surfaces without changing Experience truth.

## Acceptance

- HUD reads from `ExperienceRuntimeStore` state.
- Prompt rewrite advances the rewrite quest through a typed event.
- Spec compile advances the spec quest through a typed event.
- Review failure shows a blocker/notification in HUD state.
- Command/Game/Arena modes expose the same truth values.
- Compact HUD markup uses wrapping/min-width-safe layout classes for narrow widths.
- Tests and validation are recorded in `docs/worklog/T080-global-experience-hud-app-wide-integration.md`.
