# T027 PDF Viewer

## Task summary

Upgrade the existing PDF preview surface into a controlled viewer contract with page navigation and zoom behavior that can be validated without real PDF rendering.

Status: DONE.

## Repo context discovered

- `packages/ui/src/components/overlay/PDFPreviewOverlay.tsx` already renders PDFs using `react-pdf` and `pdfjs-dist` via `loadPdfData`.
- `packages/ui/src/components/markdown/MarkdownPdfBlock.tsx` renders inline first-page previews and opens `PDFPreviewOverlay` for fullscreen viewing.
- `apps/electron/src/renderer/App.tsx` wires PDF loading through `window.electronAPI.readFileBinary`.
- `packages/server-core/src/handlers/rpc/files.ts` validates file paths and serves `file:readBinary`.
- Existing UI tests in `packages/ui` mostly use pure Bun/Vitest checks rather than DOM rendering for complex overlays.
- The missing PARTIAL_CORE gap was component/DOM interaction coverage for `PDFPreviewOverlay`; the previous worklog explicitly left DOM-level click coverage as a remaining risk.

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
- `packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts`
- `packages/ui/src/components/overlay/__tests__/pdf-preview-overlay.test.tsx`

## Tests added first

- Added `packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts` before implementation.
- Added `packages/ui/src/components/overlay/__tests__/pdf-preview-overlay.test.tsx` before the accessibility/control implementation. The test uses local fakes for `loadPdfData`, `react-pdf`, `PreviewOverlay`, `ItemNavigator`, and `CopyButton`, plus a minimal in-test DOM runtime so no real PDF renderer or external provider is called.

## Expected failing test output

`bun test packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts` failed for the expected reason before implementation:

```text
error: Cannot find module '../pdf-viewer-state' from '/Users/marklindgreen/Projects/rox/rox/packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts'
0 pass
1 fail
1 error
```

The new component/DOM test failed for the expected product reason before the final implementation:

```text
error: Unable to find button with aria-label "Next page"
(fail) PDFPreviewOverlay DOM controls > drives page navigation and zoom controls with deterministic mocked PDF data
(pass) PDFPreviewOverlay DOM controls > renders loading, loader error, and document error states without external providers
1 pass
1 fail
10 expect() calls
```

## Implementation changes

- Added `packages/ui/src/components/overlay/pdf-viewer-state.ts` with deterministic page clamping, page labels, bounded zoom presets, and zoom labels.
- Added unit coverage for page and zoom behavior.
- Updated `PDFPreviewOverlay` to render a single selected page instead of all pages at once.
- Added header controls for previous/next page and zoom in/out while preserving the existing fakeable `loadPdfData(path)` loader and copy-path action.
- Added accessible labels to the PDF page and zoom icon-only controls so the controls are testable through DOM queries and usable by assistive technology.

## Validation commands run

- `bun test packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts`
- `cd packages/ui && bun run tsc --noEmit`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `bun run validate:docs`
- `git diff --check`
- `bun run electron:build`
- `bun test packages/ui/src/components/overlay/__tests__/pdf-preview-overlay.test.tsx`
- `bun test packages/ui/src/components/overlay/__tests__/pdf-viewer-state.test.ts packages/ui/src/components/overlay/__tests__/pdf-preview-overlay.test.tsx`
- `bun test packages/ui/src/components/overlay/__tests__`
- `cd packages/ui && bun run tsc --noEmit`
- `cd packages/ui && ../../node_modules/.bin/eslint src/components/overlay/PDFPreviewOverlay.tsx src/components/overlay/__tests__/pdf-preview-overlay.test.tsx`

Invalid validation attempt:

- `./node_modules/.bin/eslint packages/ui/src/components/overlay/PDFPreviewOverlay.tsx packages/ui/src/components/overlay/__tests__/pdf-preview-overlay.test.tsx` from the repo root failed because ESLint 9 could not find a root `eslint.config.*`. The package-local retry from `packages/ui` passed.

## Passing test output summary

- Targeted PDF viewer state test: `4 pass, 0 fail, 12 expect() calls`.
- Targeted PDF preview DOM test: `2 pass, 0 fail, 17 expect() calls`.
- Combined PDF viewer tests: `6 pass, 0 fail, 29 expect() calls`.
- Overlay test directory: `14 pass, 0 fail, 41 expect() calls`.
- UI typecheck passed after strict tuple indexing was fixed.
- UI typecheck passed for the current component change.
- Package-local ESLint passed for the touched component and new test.
- Server-core, shared, and Electron typechecks passed.
- Docs validation passed.
- `git diff --check` passed.

## Build output summary

`bun run electron:build` passed. Main, preload, renderer, resources, and asset copy completed successfully. Renderer emitted the repo's existing large chunk warnings plus existing Vite/Jotai deprecation warnings.

## Remaining risks

- The DOM interaction test intentionally mocks `react-pdf` and `PreviewOverlay`; it validates the overlay state/DOM contract, not real PDF rasterization, Radix dialog focus behavior, or pdf.js decoding.
- The inline markdown PDF block still renders a first-page preview and delegates full navigation to the overlay.
- PDF text search, thumbnails, page fit-to-width, keyboard shortcuts, and annotation selection are not implemented in this ticket.
- Worker A did not commit directly; supervisor integrates this slice in the scoped validation commit.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| PDF viewer has deterministic page state | Pass | `clampPdfPage` and `getPdfPageLabel` tests |
| PDF viewer has bounded zoom state | Pass | `stepPdfZoom` and `getPdfZoomLabel` tests |
| Overlay exposes page and zoom controls | Pass | DOM test clicks previous/next page and zoom in/out controls with mocked PDF data |
| Overlay handles loading and error states | Pass | DOM test covers pending loader, loader rejection, and mocked document parse error |
| PDF controls are accessible/testable | Pass | `PDFPreviewOverlay` page and zoom icon buttons expose `aria-label` values |
| Existing PDF loading path remains fakeable/testable | Pass | Overlay still receives `loadPdfData(path)` as an injected async loader |
