# T182 - Icon-Only Button Labels

Status: DONE

## Context

An audit of `FreeFormInput.tsx` and associated composer toolbar components identified interactive elements that conveyed meaning through icon alone with no accessible name. WCAG 2.1 SC 4.1.2 (Name, Role, Value) requires that all UI components have an accessible name. A prior maintainer cluster ("Make composer toolbar controls explain themselves", commit c2cab90) had already labeled most icon controls; the remaining gap was one button.

## Goal

Identify every icon-only interactive element in the composer input surface, verify which ones already have accessible names, and add `aria-label` + matching tooltip text for any that do not. Add the required i18n keys to all 8 locale files.

## Required UI

- `WorkingDirectoryBadge` remove button (X icon) in `FreeFormInput.tsx`: add `aria-label={t('workbench.composer.actions.removeRecentFolder')}`.
- All other interactive elements confirmed as already labeled (see §6 of worklog for the audit trail).

## Required Data/API

New i18n key (8 locale files):

- `workbench.composer.actions.removeRecentFolder`

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

Self-test deferred to T186. Validated by:
- typecheck + lint confirming the aria-label prop is well-typed
- lint:i18n:parity confirming the 1 new key landed in all 8 locales
- lint:i18n:sorted confirming insertion order

## Implementation Requirements

- Add `aria-label={t('workbench.composer.actions.removeRecentFolder')}` to the X-button on `WorkingDirectoryBadge` in `FreeFormInput.tsx`.
- Add 1 key × 8 locale files = 8 entries total.
- Document in commit message which buttons were already labeled (evidence trail for future auditors).

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun run validate:agent-contract`

## Acceptance Criteria

- [x] `WorkingDirectoryBadge` remove button has `aria-label` in all render paths.
- [x] `workbench.composer.actions.removeRecentFolder` present in all 8 locale files.
- [x] Audit trail confirms remaining icon controls are already labeled.
- [x] `lint:i18n:parity` passes.
- [x] Typecheck and lint pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T182-icon-only-button-labels.md`.
