# T472 - i18n coverage key repair

Status: DONE
Phase: i18n coverage and sorting repair
Ticket: docs/tickets/T472-i18n-coverage-key-repair.md

## 1. Task summary

Repair unsorted locale keys and five missing locale keys reported by the i18n
coverage validator.

## 2. Repo context discovered

`locale-parity.test.ts` enforces top-level JSON key sorting. `ChatPageErrorBoundary.tsx`,
`RouteErrorBoundary.tsx`, and `VoiceInputSlot.tsx` already call `t()` with
fallback strings for five keys missing from the locale source files. Recent
untranslated non-English locale keys use `[TRANSLATE]:` placeholders, so the
repair should preserve English fallback text and mark non-English values for
later translation.

## 3. Files inspected

- `apps/electron/src/renderer/pages/ChatPageErrorBoundary.tsx`
- `apps/electron/src/renderer/components/RouteErrorBoundary.tsx`
- `apps/electron/src/renderer/components/app-shell/input/VoiceInputSlot.tsx`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ru.json`
- `scripts/sort-locales.ts`

## 4. Tests added first

No new test file was needed; existing i18n validators already failed on the
target drift.

## 5. Expected failing test output

`bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts` failed
because `cheatsheet.section.composer` was out of order relative to
`chatInput.placeholder.focusMode`.

`bun run lint:i18n:coverage` failed with five missing literal key references:

- `chat.panelFailedTitle`
- `chat.panelFailedDescription`
- `composer.voiceInput.stop`
- `route.pageFailedTitle`
- `route.pageFailedDescription`

## 6. Implementation changes

Added the five missing keys to all 8 locale files. English values use the
existing renderer fallback strings; non-English values use `[TRANSLATE]:`
placeholders. Ran `bun run sort-locales` to normalize top-level key ordering.

## 7. Validation commands run

- `bun run sort-locales`
- `bun run lint:i18n:coverage`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `bun test packages/shared/src/i18n/__tests__/cheatsheet-i18n-parity.test.ts`
- `git diff --check`

## 8. Passing test output summary

Passing evidence:

- `bun run lint:i18n:coverage`: `i18n coverage OK (1512 literal references, 1153 files scanned)`.
- `bun run lint:i18n:parity`: `i18n parity OK (7 locales, 1589 keys each)`.
- `bun run lint:i18n:sorted`: exit 0.
- `bun test packages/shared/src/i18n/__tests__/locale-parity.test.ts`: 37 pass, 0 fail.
- `bun test packages/shared/src/i18n/__tests__/cheatsheet-i18n-parity.test.ts`: 65 pass, 0 fail.

## 9. Build output summary

Not applicable; this ticket changes locale data only.

## 10. Remaining risks

Non-English values are placeholder translations and should be replaced by a
localization pass later.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| All five missing literal keys are present in `en.json` | PASS | English locale now includes `chat.panelFailed*`, `composer.voiceInput.stop`, and `route.pageFailed*` |
| All bundled locales contain the same key set | PASS | `bun run lint:i18n:parity`: 7 locales, 1589 keys each |
| Locale files remain sorted | PASS | `bun run lint:i18n:sorted`: exit 0; `locale-parity.test.ts`: 37 pass |
| Existing renderer fallback text is preserved in the English source locale | PASS | English values mirror the fallback strings in the renderer call sites |
