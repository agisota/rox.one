# T237b worklog — Paste-image resize/re-encode before attach

## 1. Goal

When an image pasted into the composer exceeds 2 MB or 2048 px on
its longest edge, surface a "Resize before attach (recommended)"
toggle in the existing T237 preview dialog. Default ON; on confirm
with the toggle ON, scale to fit and re-encode as JPEG at q=0.85.

## 2. Approach

Two atomic commits on this branch:

1. `image-resize.ts` + bun:test (26 cases / 41 expect).
2. Dialog extension + RTL extension + i18n strings (8 locales) +
   ticket + worklog.

The dialog only exposes the toggle; the host (`FreeFormInput.tsx`)
is frozen for T237 in this PR and picks up the toggle state via
`onConfirm({ resize })`. Host wiring is the T237c follow-up.

## 3. Decisions

- **Pure math separate from canvas draw** — `shouldResize` and
  `computeTargetDimensions` are framework-agnostic, easy to cover
  under `bun:test`. The `resizeImage` canvas path lives in the same
  module behind a feature-detect so the dialog only has one import.
- **Loader injection seam** — mirrors `paste-image.ts`'s pattern.
  Tests inject `decodeImage` / `drawToDataUrl` overrides so they
  never need a real DOM `<canvas>`.
- **Backward-compatible prop signature** — `onConfirm` now accepts
  an optional `{resize}` argument. Hosts on the legacy zero-arg
  signature still compile.
- **JPEG @ q=0.85** — industry-standard "visually lossless"
  threshold; bounds the resized output well under the 2 MB budget
  for the typical 4096×3072 phone-camera frame.

## 4. Files touched

| Path                                                                                                  | Status |
| ----------------------------------------------------------------------------------------------------- | ------ |
| `apps/electron/src/renderer/components/app-shell/input/image-resize.ts`                               | new    |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/image-resize.test.ts`                | new    |
| `apps/electron/src/renderer/components/app-shell/input/PasteImagePreviewDialog.tsx`                   | edited |
| `apps/electron/src/renderer/components/app-shell/input/__tests__/paste-image-preview-dialog.rtl.test.tsx` | edited |
| `packages/shared/src/i18n/locales/{de,en,es,hu,ja,pl,ru,zh-Hans}.json`                                | edited |
| `docs/tickets/T237b-paste-image-resize.md`                                                            | new    |
| `docs/worklog/T237b-paste-image-resize.md`                                                            | new    |

## 5. Validation

- `bun test image-resize.test.ts` — 26 pass / 41 expect calls.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pre-existing T223 baseline
  failure (unrelated).
- `bun run validate:roadmap` — pre-existing M.1.3b baseline failure
  (unrelated).

## 6. Follow-ups

- **T237c** — wire `resizePreviewIfNeeded` into
  `FreeFormInput.handleConfirmPastedImage`, and extend coverage to
  drag-from-other-apps `DataTransferItemList` events.

## 7. Closeout

- 2 MB / 2048 px budget defaults plumbed; toggle defaults to ON.
- Both new i18n keys present in all 8 locales.
- Helper + dialog extension covered by bun:test + RTL.
