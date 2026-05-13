# T237 - Composer paste-image preview dialog

Status: DONE
Phase: M.10

## Context

M.10 Composer Pillar 4 sub-feature #4 of 5. Before T237, an image
pasted into the composer (Cmd+V) attached immediately as an opaque
binary blob — no preview, no confirmation, no metadata. T237 adds
an explicit preview dialog that shows the pasted image, its file
name, dimensions, and a size hint, with Confirm/Cancel buttons.

## Scope

- `apps/electron/src/renderer/components/app-shell/input/paste-image.ts` —
  pure helper `extractPastedImage(event)` that pulls a `File` (or
  `Blob` for Drop) off the clipboard / drop event, reads the
  data-URL via `FileReader`, and measures dimensions via an
  off-screen `Image` element. Returns `null` if no image found.
- `apps/electron/src/renderer/components/app-shell/input/PasteImagePreviewDialog.tsx` —
  modal dialog (using existing `@rox-one/ui` Dialog primitive) with
  image preview, file name, dimensions, size hint, and
  Confirm/Cancel buttons.
- Wiring in `FreeFormInput.tsx` — intercept `onPaste` (and drop
  handler); when an image is found, open the dialog instead of
  immediate attach. On confirm, reuse the existing attachment path.
- 4 i18n keys across all 8 locales:
  `workbench.composer.pasteImage.title`,
  `workbench.composer.pasteImage.confirm`,
  `workbench.composer.pasteImage.cancel`,
  `workbench.composer.pasteImage.dimensions`.

## Out of scope

- Resizing / re-encoding the image before attach (deferred to T237b
  if image-size budgets become a constraint).
- Drag-from-other-apps surface coverage beyond standard Drop events
  (T237c if needed).

## Validation gates

- `bun test paste-image.test.ts` — pure helper covered.
- `bun run lint:i18n:parity` — pass (8 locales).
- `bun run validate:agent-contract` — pre-existing main-baseline
  failure on T223 Status line (unrelated).
- `bun run validate:roadmap` — pre-existing main-baseline failure
  on M.1.3b heading (unrelated).

## Follow-ups

- **T237b** — image resize/re-encode (size-budget-aware).
- **T238** — voice-input toolbar slot (final Pillar 4 sub-feature).
