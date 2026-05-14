# T472 - i18n coverage key repair

Status: DONE

## Context

The T470 full-suite validation run exposed unsorted locale keys, and follow-up
i18n validation found five literal translation keys used by renderer components
but missing from `en.json`.

## Goal

Sort the bundled locale files and add the missing locale keys across all bundled
locale files so the i18n coverage, parity, and sorting gates agree.

## Required UI

No layout or interaction changes.

## Required Data/API

No data or API changes.

## Required Automations

Use the existing i18n validators as the failing regression checks:

- `bun run lint:i18n:coverage`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`

## Required Subagents

None required; the failing command names the exact missing keys and call sites.

## TDD Requirements

- Confirm `bun run lint:i18n:coverage` fails before adding keys.
- Confirm `locale-parity.test.ts` fails before sorting locale keys.
- Add the missing keys only.
- Re-run coverage, parity, and sorting checks.

## Implementation Requirements

- Preserve existing renderer fallback strings.
- Add English source values from the existing callsite fallback text.
- Use `[TRANSLATE]: ...` placeholders for non-English locales to match the
  current placeholder convention for recent untranslated keys.

## Validation Commands

- `bun run lint:i18n:coverage`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `git diff --check`

## Acceptance Criteria

- [x] All five missing literal keys are present in `en.json`.
- [x] All bundled locales contain the same key set.
- [x] Locale files remain sorted.
- [x] Existing renderer fallback text is preserved in the English source locale.
