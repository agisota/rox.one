# T233 - Composer Pillar 4 Design Spec

Status: DONE

## Context

Pillar 3 of the composer polish series (tickets T180..T199) shipped axe-core
test infrastructure, RTL coverage for `FreeFormInput`, accessibility fixes,
and a closing dialog A11y audit. The master roadmap (Phase 10) calls for a
Pillar 4 cluster covering emphasis modes, multi-line affordances, slash and
mention surface polish, attachment paste-image polish, composer history, and
a voice-input slot. Before tickets T235..T240 can land, a single design spec
must lock the cluster scope, surface boundary, and per-sub-ticket conventions.

The composer surface lives at
`apps/electron/src/renderer/components/app-shell/input/` (not a top-level
`composer/` directory). Pillar 4 stays inside that surface and reuses the
Pillar 3 RTL harness.

## Goal

Land the Pillar 4 design spec at
`docs/superpowers/specs/2026-05-13-composer-pillar-4-design.md` covering at
least four follow-on affordances with the same A11y + RTL + animation +
visual polish layers used in Pillar 3, and pick the smallest sub-ticket
(T234, composer history recall) for first implementation in the same PR.

## Required UI

None for the spec itself. Each sub-ticket binds its own UI requirements.

## Required Data/API

None for the spec itself. Each sub-ticket binds its own data shape (history
stack, paste-image dialog state, etc.).

## Required Automations

None.

## Required Subagents

None. Spec authoring is scoped to a single design doc + ticket pair.

## TDD Requirements

The spec ticket itself ships no tests beyond confirming `validate:rebrand`
stays green. The first sub-ticket (T234) ships pure-function + RTL coverage
(see `T234-composer-pillar-4-history.md`).

## Implementation Requirements

- Author `docs/superpowers/specs/2026-05-13-composer-pillar-4-design.md`
  with the locked-decisions, sub-ticket cluster, data-flow, and acceptance
  matrix sections per the Pillar 4 spec template above.
- Author the matching ticket entry (this file).
- Pick the smallest sub-feature in the cluster (composer history) and land
  it as T234 in the same PR.
- Do not touch `.swarm/master-roadmap-log.md`.

## Validation Commands

- `bun run validate:rebrand`

## Acceptance Criteria

- [x] Pillar 4 design spec lives at the path above.
- [x] Spec lists 4 or more sub-ticket candidates.
- [x] Spec calls out the input/ directory as the surface boundary.
- [x] Locked decisions section captures session scope, keyboard helper, axe
      conventions, voice-input slot semantics.
- [x] First sub-ticket (T234) is named and rationalised in the spec.
- [x] `validate:rebrand` exit 0.
- [x] `.swarm/master-roadmap-log.md` is not touched.
- [x] Worklog at `docs/worklog/T233-composer-pillar-4-spec.md`.

## Worklog

See `docs/worklog/T233-composer-pillar-4-spec.md`.
