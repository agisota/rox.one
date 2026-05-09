# T181 - RichTextInput aria-label + describedby

Status: DONE

## Context

The composer's primary text input (`RichTextInput`) had no `aria-label` or `aria-describedby`. Screen readers announced the component as an unnamed text field, making it impossible for VoiceOver / NVDA users to understand what they were interacting with or what the rotating placeholder text communicated.

## Goal

Add an `ariaLabel` prop to `RichTextInput` (defaulting to the i18n key `workbench.composer.input.label`) and an `aria-describedby` pointing to a visually-hidden span containing the current rotating placeholder text. Wire `FreeFormInput` to pass a context-aware label (`editLabel` when editing an existing message, `inputLabel` otherwise). Add the i18n keys to all 8 locale files atomically.

## Required UI

- `<textarea>` or ProseMirror contenteditable inside `RichTextInput` carries `aria-label`.
- A visually-hidden `<span id={describedById}>` contains the current rotating placeholder.
- `<textarea aria-describedby={describedById}>` points to that span.
- When `FreeFormInput` is in editing mode (compactMode prop signals this), `aria-label` reads the edit-specific label.

## Required Data/API

New i18n keys (8 locale files):

- `workbench.composer.input.label` — primary input label
- `workbench.composer.input.editLabel` — label override when editing an existing message

## Required Automations

None.

## Required Subagents

None; component surface is localized.

## TDD Requirements

Self-test deferred to T186 (DOM-bearing Vitest tests). Validated by:
- typecheck on changed components
- lint:i18n:parity confirms all 8 locales received both keys
- lint:i18n:sorted confirms key order
- lint:electron confirms no lint regressions

## Implementation Requirements

- Add `ariaLabel?: string` prop to `RichTextInput` interface; default to `t('workbench.composer.input.label')`.
- Add `aria-describedby` wiring with a stable element ID for the placeholder span.
- `FreeFormInput` detects edit mode via `compactMode` prop (there is no separate `isEditingMessage` prop in this version) and passes `editLabel` accordingly.
- Add 2 keys × 8 locale files = 16 entries total.

## Validation Commands

- `bun run typecheck:electron`
- `bun run lint:electron`
- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun run validate:agent-contract`

## Acceptance Criteria

- [x] `RichTextInput` exposes `aria-label` on the editable element.
- [x] `aria-describedby` links to the visually-hidden placeholder span.
- [x] `FreeFormInput` passes edit-mode label when in compact/edit mode.
- [x] Both i18n keys present in all 8 locale files.
- [x] `lint:i18n:parity` passes.
- [x] Typecheck and lint pass.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

See `docs/worklog/T181-rich-text-input-aria-label.md`.
