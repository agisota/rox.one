# T237 worklog — Composer paste-image preview dialog

## 1. Goal

When an image is pasted into the composer (Cmd+V, drag-drop), open
a preview dialog with the image, file name, dimensions, and size,
plus Confirm/Cancel. On Confirm, the image becomes a regular
attachment via the existing attachment path.

## 2. Approach

Four atomic commits already on this branch:

1. `dd2085e1` — pure `extractPastedImage(event)` helper +
   `paste-image.test.ts` bun:test coverage.
2. `3066286f` — `PasteImagePreviewDialog.tsx` presentational
   component + RTL coverage.
3. `f6c86162` — `FreeFormInput.tsx` wiring: intercept paste/drop,
   open dialog, reuse attachment path on confirm.
4. `1fbb1e46` — 4 i18n keys × 8 locales.

This closing commit lands the ticket + worklog.

## 3. Decisions

- **Pure helper separate from React** — the data-URL extraction
  and image dimension measurement are DOM-y but framework-agnostic.
  Testing the helper directly gives a fast bun:test pass without
  rendering the dialog.
- **Reuse existing attachment path** — the dialog's "Confirm" hook
  feeds into whatever the existing FreeFormInput attachment flow is.
  No new IPC; no new persistence.
- **i18n key prefix** — `workbench.composer.pasteImage.*` matches
  the existing `workbench.composer.emphasis.*` /
  `workbench.composer.voiceInput.*` siblings.

## 4. Files touched

| Path                                                                                                  | Status |
| ----------------------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/app-shell/input/paste-image.ts`                                | new (commit dd2085e1) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/paste-image.test.ts`                 | new (commit dd2085e1) |
| `apps/electron/src/renderer/components/app-shell/input/PasteImagePreviewDialog.tsx`                   | new (commit 3066286f) |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/paste-image-preview-dialog.rtl.test.tsx` | new (commit 3066286f) |
| `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`                             | edited (commit f6c86162) |
| `packages/shared/src/i18n/locales/{en,de,es,hu,ja,pl,ru,zh-Hans}.json`                                | edited (commit 1fbb1e46) |
| `docs/tickets/T237-composer-paste-image-preview.md`                                                   | new    |
| `docs/worklog/T237-composer-paste-image-preview.md`                                                   | new    |

## 5. Validation

- `bun test paste-image.test.ts` — pass
- `bun run lint:i18n:parity` — pass (8 locales)
- `bun run validate:agent-contract` — pre-existing T223 baseline failure (unrelated)
- `bun run validate:roadmap` — pre-existing M.1.3b heading baseline failure (unrelated)

## 6. Follow-ups

- **T237b** — resize/re-encode large images before attach.
- **T237c** — drag-from-other-apps event coverage.

## 7. Closeout

- Dialog shipped at the composer surface.
- Paste/drop both route through the dialog.
- All 4 i18n keys present in 8 locales.
