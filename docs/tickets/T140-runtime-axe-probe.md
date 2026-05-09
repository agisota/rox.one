# T140 - Runtime-axe probe + fixture

Status: complete

## Context

Phase A.2 of the audit harness. Add the `runtime-axe` probe to run `@axe-core/playwright` against discoverable routes, emitting WCAG 2.2 AA violations per-route with severity mapping from axe impact levels.

## Summary

Implement `packages/audit/src/probes/runtime-axe.ts` using `@axe-core/playwright` to analyze accessibility violations. Discovery returns routes via `discoverRoutes()`; for fixtures with no routes, special-case to audit `index.html` as a single page. Map axe impact (critical/serious/moderate) to Finding severity. Extract violation node HTML as evidence. Confidence = 1 (not heuristic). Create hermetic fixture `packages/audit/tests/fixtures/axe-broken/` with 3+ known violations: missing title, button without accessible name, image without alt. Write tests validating probe metadata and fixture violations.

## Acceptance Criteria

- [x] `packages/audit/src/probes/runtime-axe.ts` exports `runtimeAxeProbe` with name, phase A.2, applicableTo returns true.
- [x] `runtimeAxeProbe.run()` accepts `ProbeContext` with playwright instance; returns `Finding[]`.
- [x] Uses `discoverRoutes()` to walk available routes; special-cases single `index.html` for fixtures.
- [x] Severity mapping: critical→critical, serious→high, moderate→medium, others→low.
- [x] Evidence includes `node.html` code snippet.
- [x] Confidence = 1 (not heuristic).
- [x] Fixture `packages/audit/tests/fixtures/axe-broken/index.html` contains 3+ WCAG violations (missing title, button name, image alt).
- [x] `packages/audit/tests/probes/runtime-axe.test.ts` — 2 tests pass (metadata, detects violations on fixture).
- [x] CLI wired: probe registered, playwright context injected when any A.2 probe selected.
- [x] `cd packages/audit && bun run typecheck` exits 0.
- [x] Worklog `docs/worklog/T140-runtime-axe-probe.md` complete.
- [x] Commit created.

## TDD Test Shape

Files: `tests/probes/runtime-axe.test.ts`, `tests/fixtures/axe-broken/`.

```
runtime-axe.test.ts:
  - metadata (name, phase, applicableTo)
  - detects WCAG violations on fixture page (≥2 findings expected)
```

## Files Affected

| File | Action |
|---|---|
| `packages/audit/src/probes/runtime-axe.ts` | Create |
| `packages/audit/tests/probes/runtime-axe.test.ts` | Create |
| `packages/audit/tests/fixtures/axe-broken/index.html` | Create |
| `packages/audit/tests/fixtures/axe-broken/package.json` | Create |
| `packages/audit/src/cli.ts` | Modify — register probe, inject playwright |
| `packages/audit/src/probe.ts` | Modify — activate optional `playwright` field in ProbeContext |

## Validation Commands

```bash
cd packages/audit && bun test tests/probes/runtime-axe.test.ts
bun run audit run marketing --probes=runtime-axe
```

## Worklog

`docs/worklog/T140-runtime-axe-probe.md`
