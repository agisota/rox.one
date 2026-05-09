# T189 - Coverage Reporter + Tracking Doc

Status: DONE

## Context

T187 + T188 added 46 RTL tests but coverage for FreeFormInput.tsx remained well below the 70% aspirational target. Two large code regions — the model picker dropdown and `WorkingDirectoryBadge` — are blocked from coverage by a multi-copy `@radix-ui/react-context` issue and the component's monolithic structure. Before setting a CI gate, the team needs a factual baseline and a documented explanation of why 70% requires deferred work.

## Goal

Add `'text-summary'` to the vitest coverage reporters so every `bun run test:rtl:coverage` run prints a concise summary. Write `COVERAGE.md` in the input `__tests__/` directory to record the current baseline and the path to 70%.

## Required UI

None — tooling and documentation only.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Not applicable. `bun run test:rtl:coverage` must exit 0 and print a text-summary block.

## Implementation Requirements

- `apps/electron/vitest.config.ts`: add `'text-summary'` to `coverage.reporter` array (was `['text', 'json']`, now `['text', 'text-summary', 'json']`).
- `apps/electron/src/renderer/components/app-shell/input/__tests__/COVERAGE.md`:
  - Documents current FreeFormInput.tsx coverage: 36.30% lines, 46.25% branches, 23.40% functions.
  - Explains the two uncovered regions: model picker dropdown (~270 LOC, Radix context issue) and WorkingDirectoryBadge (~240 LOC, needs component split).
  - Documents the two deferred options to hit 70%: resolve multi-copy Radix context issue, or split FreeFormInput.
  - States explicitly: no CI gate yet; threshold lands in a future sub-project after the FreeFormInput-split refactor.

## Validation Commands

- `bun run test:rtl:coverage`

## Acceptance Criteria

- [x] `vitest.config.ts` includes `'text-summary'` reporter.
- [x] `COVERAGE.md` exists with current baseline and documented path to 70%.
- [x] `bun run test:rtl:coverage` exits 0 and prints a text-summary.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T189-coverage-reporter-tracking-doc.md`.
