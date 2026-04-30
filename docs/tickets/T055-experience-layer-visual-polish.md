# T055 — Experience Layer visual polish

Status: DONE

## Context
Experience Layer screens are now reachable from the shell, but the first pass is still too technical and English-heavy. The user wants RU-first copy, better typography, alignment, color hierarchy, visible gamification affordances, and polished interaction states.

## Goal
Turn the Deep Missions, Arena Builder, Mission Control, Progression Observatory, Quest Map, and Agent Forge surfaces into a cohesive command/game/arena experience layer without changing the shared truth model or weakening integrity gates.

## Acceptance Criteria
- [x] Experience screens use a shared visual shell and reusable cards/chips/metrics.
- [x] Primary UI copy is Russian-first.
- [x] Gamification state is visible through status chips, progress, rarity, XP/credits, unlock state, and validation state.
- [x] Interactive cards and buttons expose hover, focus, active, transition, and reduced-motion-safe classes.
- [x] Paid capacity remains capacity-only and does not change quality/VDI truth.
- [x] Targeted tests, typecheck, lint, build, smoke/run evidence pass.
