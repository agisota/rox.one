# T056 — Experience Layer RU hardening

Status: DONE

## Context
T055 added the shared Experience visual system and translated the primary screens, but a second pass found visible English product scaffolding in metrics, helper copy, summaries, and agent package metadata.

## Goal
Harden the visible Experience Layer copy so command/game/arena surfaces feel intentionally Russian-first while keeping canonical state values and tests deterministic.

## Acceptance Criteria
- [x] Mission Control checkpoint metadata and summaries do not render stale English fragments like `VDI delta` or `summary`.
- [x] Arena budget and roster microcopy render Russian labels for credits, levels, trust floor, capacity, and required gates.
- [x] Progression capacity copy is Russian-first.
- [x] Agent Forge trust/package/registry copy is Russian-first and still preserves trust/contract meaning.
- [x] Targeted component tests, workbench tests, typecheck, lint, build, and live run checks pass.
