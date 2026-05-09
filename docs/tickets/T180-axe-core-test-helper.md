# T180 - axe-core Test Helper

Status: DONE

## Context

Pillar 1 of sub-project B establishes the a11y testing foundation before component-level fixes land. The repo already has axe-core 4.10.3 in node_modules (pulled by packages/audit). bun:test does not provide a DOM at runtime; axe-core requires a live DOM to run. The helper needs to be safe to import and self-documenting about its runtime requirements.

## Goal

Ship a reusable `expectNoA11yViolations()` and `runAxe()` helper at `apps/electron/src/test-utils/a11y.ts` that wraps axe-core with WCAG 2.x rule sets, throws a readable `AxeViolationsError` on violations, and defers its own DOM-bearing self-test to Pillar 2's Vitest+happy-dom configuration (T186).

## Required UI

None — test infrastructure only.

## Required Data/API

- axe-core 4.10.3 (already in node_modules via packages/audit)
- `AxeResults`, `Result`, `RunOptions`, `Spec` types from axe-core

## Required Automations

None.

## Required Subagents

None; files are well-understood.

## TDD Requirements

Helper cannot self-test under bun:test (no DOM). Self-test deferred to T186. Per-component a11y tests in T181-T185 exercise it indirectly. Document the constraint clearly inside the helper so future contributors understand why no co-located test exists.

## Implementation Requirements

- Export `expectNoA11yViolations(target, overrides?)` — throws `AxeViolationsError` on violations.
- Export `runAxe(target, overrides?)` — returns raw `AxeResults` for tests that need to assert on specific violations.
- Export `AxeViolationsError` class with `violations: Result[]` property and human-readable `.message`.
- Default rule set: `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` — mirrors `packages/audit`'s runtime-axe probe.
- Parse HTML strings via `DOMParser` + node-by-node `appendChild` — never use `innerHTML` to avoid XSS hook warnings.
- Throw a clear setup error (`no DOM available`) when `document` is undefined; direct caller to T186 Vitest config.

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run validate:agent-contract`

## Acceptance Criteria

- [x] `expectNoA11yViolations` is exported from `apps/electron/src/test-utils/a11y.ts`.
- [x] `runAxe` is exported with raw-results contract.
- [x] `AxeViolationsError` includes `violations` array and readable message with rule ID, impact, target selector, and help URL.
- [x] Default rule set mirrors `packages/audit`'s WCAG probe.
- [x] HTML strings parsed without `innerHTML`.
- [x] Clear setup error thrown when `document` is undefined.
- [x] Typecheck and lint pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T180-axe-core-test-helper.md`.
