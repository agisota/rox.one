# T237b - Paste-image resize/re-encode before attach

Status: DONE
Phase: M.10

## Context

M.10 Composer Pillar 4 follow-up to T237 (PR #124, shipped on
`main`). The paste-image preview dialog from T237 attaches images
as-is, so a multi-megapixel screenshot or phone-camera frame can
bloat the session payload by several megabytes per turn.

T237b adds an optional resize / re-encode pass inside the dialog:
when the pasted image exceeds the configured byte (2 MB) or
longest-edge pixel (2048 px) budget, the dialog surfaces a "Resize
before attach (recommended)" toggle (default ON). On confirm with
the toggle ON, the helper scales the image to fit and re-encodes
as JPEG at quality 0.85.

## Scope

- `apps/electron/src/renderer/components/app-shell/input/image-resize.ts` —
  pure helpers `shouldResize`, `computeTargetDimensions`,
  `estimateDataUrlBytes`, plus the canvas-backed `resizeImage` and
  one-shot `resizePreviewIfNeeded` wrapper for the dialog. Loader
  injection seam (`ResizeImageLoaders`) mirrors `paste-image.ts`'s
  pattern so the math can be tested under `bun:test` without a real
  DOM.
- `apps/electron/src/renderer/components/app-shell/input/PasteImagePreviewDialog.tsx` —
  surfaces a Switch + recommendation hint when `shouldResize` fires.
  Forwards the user's toggle state via `onConfirm({ resize })` —
  backward-compatible with the legacy zero-arg signature.
- 2 new i18n keys across all 8 locales:
  `workbench.composer.pasteImage.resizeToggle`,
  `workbench.composer.pasteImage.resizeHint`.
- Tests:
  - `__tests__/image-resize.test.ts` — 26 bun:test cases, 41
    `expect()` calls covering the math.
  - `__tests__/paste-image-preview-dialog.rtl.test.tsx` — 4 new RTL
    cases covering toggle visibility, default-ON state, hint
    rendering, and on-confirm forwarding.

## Out of scope

- Wiring the host (`FreeFormInput.tsx`) to run `resizePreviewIfNeeded`
  inside `handleConfirmPastedImage`. T237 is frozen for this PR;
  the dialog forwards the user's choice via the prop and the host
  pickup is tracked as a follow-up.
- Drag-from-other-apps surface coverage beyond standard paste / drop
  (T237c).

## Validation gates

- `bun test image-resize.test.ts` — 26 pass / 41 expect.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pre-existing T223 baseline
  failure (unrelated).
- `bun run validate:roadmap` — pre-existing M.1.3b baseline failure
  (unrelated).

## Follow-ups

- **T237c** — host wiring + drag-from-other-apps coverage.
