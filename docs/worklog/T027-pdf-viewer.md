# T027 PDF Viewer

## Task summary

Upgrade the existing PDF preview surface into a controlled viewer contract with page navigation and zoom behavior that can be validated without real PDF rendering.

## Repo context discovered

- `packages/ui/src/components/overlay/PDFPreviewOverlay.tsx` already renders PDFs using `react-pdf` and `pdfjs-dist` via `loadPdfData`.
- `packages/ui/src/components/markdown/MarkdownPdfBlock.tsx` renders inline first-page previews and opens `PDFPreviewOverlay` for fullscreen viewing.
- `apps/electron/src/renderer/App.tsx` wires PDF loading through `window.electronAPI.readFileBinary`.
- `packages/server-core/src/handlers/rpc/files.ts` validates file paths and serves `file:readBinary`.
- Existing UI tests in `packages/ui` mostly use pure Bun/Vitest checks rather than DOM rendering for complex overlays.

## Files inspected

- `docs/tickets/T027-pdf-viewer.md`
- `packages/ui/src/components/overlay/PDFPreviewOverlay.tsx`
- `packages/ui/src/components/markdown/MarkdownPdfBlock.tsx`
- `packages/ui/src/components/overlay/rich-block-interaction-spec.ts`
- `packages/ui/src/components/overlay/PreviewOverlay.tsx`
- `packages/shared/src/i18n/locales/en.json`
- `packages/shared/src/i18n/locales/ru.json`
- `apps/electron/src/renderer/App.tsx`
- `packages/server-core/src/handlers/rpc/files.ts`

## Tests added first

- Added `packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts` before implementation.

## Expected failing test output

`bun test packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts` failed for the expected reason before implementation:

```text
error: Cannot find module '../pdf-viewer-state' from '/Users/marklindgreen/Projects/rox/rox/packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts'
0 pass
1 fail
1 error
```

## Implementation changes

- Added `packages/ui/src/components/overlay/pdf-viewer-state.ts` with deterministic page clamping, page labels, bounded zoom presets, and zoom labels.
- Added unit coverage for page and zoom behavior.
- Updated `PDFPreviewOverlay` to render a single selected page instead of all pages at once.
- Added header controls for previous/next page and zoom in/out while preserving the existing fakeable `loadPdfData(path)` loader and copy-path action.

## Validation commands run

- `bun test packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts`
- `cd packages/ui && bun run tsc --noEmit`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`

## Passing test output summary

- Targeted PDF viewer state test: `4 pass, 0 fail, 12 expect() calls`.
- UI typecheck passed after strict tuple indexing was fixed.
- Server-core, shared, and Electron typechecks passed.
- Docs validation passed.
- `git diff --check` passed.

## Build output summary

`bun run electron:build` passed. Main, preload, renderer, resources, and asset copy completed successfully. Renderer emitted the repo's existing large chunk warnings.

## Remaining risks

- No DOM-level click test was added for the overlay because the current UI test surface mostly validates pure contracts for complex overlay behavior.
- The inline markdown PDF block still renders a first-page preview and delegates full navigation to the overlay.
- PDF text search, thumbnails, page fit-to-width, and annotation selection are not implemented in this ticket.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| PDF viewer has deterministic page state | Pass | `clampPdfPage` and `getPdfPageLabel` tests |
| PDF viewer has bounded zoom state | Pass | `stepPdfZoom` and `getPdfZoomLabel` tests |
| Overlay exposes page and zoom controls | Pass | `PDFPreviewOverlay` header uses previous/next page and zoom in/out icon controls |
| Existing PDF loading path remains fakeable/testable | Pass | Overlay still receives `loadPdfData(path)` as an injected async loader |
