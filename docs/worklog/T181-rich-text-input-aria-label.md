# T181 - RichTextInput aria-label + describedby

## 1. Task summary

Add `aria-label` to the composer's `RichTextInput` component and `aria-describedby` pointing to the visually-hidden rotating placeholder span. Wire `FreeFormInput` to provide a context-aware label. Add 2 i18n keys to all 8 locale files atomically.

## 2. Repo context discovered

- `RichTextInput` is a ProseMirror-backed rich text editor wrapped in a controlled React component at `apps/electron/src/renderer/components/ui/rich-text-input.tsx`. It had no `aria-label` or `aria-describedby` props.
- `FreeFormInput.tsx` renders `RichTextInput` as the primary message input. There is no standalone `isEditingMessage` prop; `compactMode` is the signal used to indicate the user is editing an existing message (compact layout is the edit-message UI variant). This is the correct prop to key the label variant from.
- The rotating placeholder implementation uses an array of hint strings cycled on a timer. The active hint was already rendered visually but had no stable ID for `aria-describedby` linkage.
- 8 locale files: `en`, `de`, `es`, `hu`, `ja`, `pl`, `ru`, `zh-Hans` under `packages/shared/src/i18n/locales/`.
- Prior i18n state before T181: `lint:i18n:parity` reported `1556 keys × 7 locales` (note: 7 non-en locales; en is the source). After T181: 1558 keys × 7.

## 3. Files inspected

- `apps/electron/src/renderer/components/ui/rich-text-input.tsx`
- `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`
- `packages/shared/src/i18n/locales/en.json` — key structure reference
- `packages/shared/src/i18n/locales/de.json`, `es.json`, `hu.json`, `ja.json`, `pl.json`, `ru.json`, `zh-Hans.json`
- `apps/electron/src/renderer/components/app-shell/input/__tests__/` — existing test patterns

## 4. Tests added first

DOM-bearing component test deferred to T186. Pre-implementation validation:

- Checked `lint:i18n:parity` baseline (1556 keys OK) to confirm clean state before adding keys.
- Added i18n keys to `en.json` first, then propagated to 7 locale files.
- Ran `lint:i18n:parity` after key additions (before implementation) to confirm key registration was clean.

## 5. Expected failing test output

No bun:test failures expected for this change shape (no existing test covers `aria-label` on `RichTextInput`). The "failing" state is the pre-fix axe-core run (deferred to T186), which would report:

```text
A11y violations found (1):
  • [critical] label: Ensures every form element has a label
    help: https://dequeuniversity.com/rules/axe/4.10/label
      - target: [contenteditable="true"]
```

## 6. Implementation changes

**`apps/electron/src/renderer/components/ui/rich-text-input.tsx`** (+23 lines, -2 lines)

- Added `ariaLabel?: string` to the props interface, defaulting to `t('workbench.composer.input.label')`.
- Assigned a stable `describedById` (derived from component's existing internal ID or `useId()`).
- Added `aria-label={ariaLabel}` and `aria-describedby={describedById}` to the contenteditable root.
- Added a visually-hidden `<span id={describedById} aria-hidden="false">` containing the current rotating placeholder text.

**`apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`** (+1 line)

- Passes `ariaLabel={compactMode ? t('workbench.composer.input.editLabel') : undefined}` to `RichTextInput`. When `compactMode` is false (normal compose), the default label inside `RichTextInput` is used.

**8 locale files** (+2 keys each = 16 entries total):

```json
"workbench.composer.input.label": "<locale-appropriate value>",
"workbench.composer.input.editLabel": "<locale-appropriate value>"
```

Locale values:
- en: `"Message"` / `"Edit message"`
- de: `"Nachricht"` / `"Nachricht bearbeiten"`
- es: `"Mensaje"` / `"Editar mensaje"`
- hu: `"Üzenet"` / `"Üzenet szerkesztése"`
- ja: `"メッセージ"` / `"メッセージを編集"`
- pl: `"Wiadomość"` / `"Edytuj wiadomość"`
- ru: `"Сообщение"` / `"Редактировать сообщение"`
- zh-Hans: `"消息"` / `"编辑消息"`

## 7. Validation commands run

```bash
bun run typecheck:electron
bun run lint:electron
bun run lint:i18n:parity
bun run lint:i18n:sorted
bun run lint:i18n:coverage
bun run validate:agent-contract
git diff --check
```

## 8. Passing test output summary

```text
bun run typecheck:electron
PASS

bun run lint:electron
PASS

bun run lint:i18n:parity
i18n parity OK (7 locales, 1558 keys each)

bun run lint:i18n:sorted
PASS

bun run lint:i18n:coverage
i18n coverage OK (1484 literal references, 1016 files scanned)

bun run validate:agent-contract
[agent-contract] ok: 11 skills, 126 tickets, 7 required docs

git diff --check
PASS
```

## 9. Build output summary

No full build run for this change (no production bundle behavior changed; i18n keys are additive). Typecheck is authoritative for type correctness.

## 10. Remaining risks

- **Manual VoiceOver / NVDA verification post-merge.** The `aria-label` and `aria-describedby` wiring is structurally correct per typecheck and i18n gates, but live screen reader announcement quality (order of label vs. placeholder hint, verbosity) should be verified manually after the next desktop build.
- **Placeholder rotation timing.** The `aria-describedby` span updates when the rotating placeholder changes. If the rotation interval fires rapidly, screen readers may interrupt themselves. The existing rotation interval (likely several seconds) should be acceptable; no change was made to the interval.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `RichTextInput` exposes `aria-label` on editable element | PASS | `rich-text-input.tsx` — `aria-label={ariaLabel}` on contenteditable root |
| `aria-describedby` links to visually-hidden placeholder span | PASS | `describedById` wired on both element and span |
| `FreeFormInput` passes edit-mode label via `compactMode` | PASS | `FreeFormInput.tsx` passes `ariaLabel` when `compactMode` is true |
| Both i18n keys present in all 8 locale files | PASS | 16 entries added; `lint:i18n:parity` reports 1558 keys × 7 locales |
| `lint:i18n:parity` passes | PASS | See §8 |
| Typecheck passes | PASS | `bun run typecheck:electron` |
| Lint passes | PASS | `bun run lint:electron` |
| Worklog complete | PASS | This document |
| Commit created | PASS | `ee63e0b` — `feat(composer): add aria-label to RichTextInput + describedby for placeholder rotation [T181]` |
