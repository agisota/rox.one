# T237c — drag-from-other-apps paste-image
Status: DONE
Phase: M.10

## Context

Follow-up to T237 (paste-image preview dialog) and T237b (resize/re-encode
before attach). T237b's out-of-scope note explicitly deferred drag-from-other-
apps surface coverage to this ticket.

When a user drags an image from macOS Finder, Windows Explorer, a web browser,
or any other external application into the ROX ONE composer, the image should
flow through the same preview dialog introduced in T237 — giving the user a
chance to confirm before the image becomes an attachment, and optionally
triggering the T237b resize path when the image exceeds the 2 MB / 2048 px budget.

## Scope

### New: `apps/electron/src/renderer/components/app-shell/input/extractDroppedImage.ts`

Pure, framework-agnostic helper that accepts a `DataTransfer` object and returns
`Promise<Blob | null>`. Three strategies are tried in order:

1. **`DataTransfer.files`** — primary path for OS file-manager drops. Iterates
   the `FileList` and returns the first `File` with an `image/*` MIME type.
   Directory entries (type `''`) are filtered out.

2. **`DataTransfer.items`** — fallback when `files` is empty/unpopulated. Only
   `DataTransferItem` entries with `kind === 'file'` and `image/*` type are
   considered; `getAsFile()` is called and the first non-null result returned.

3. **`text/uri-list` / `text/x-moz-url`** — handles browser-to-app drags where
   the image binary is not embedded but its URL is supplied as a text item.
   The URI list is parsed (comment lines and non-http(s) entries discarded),
   each candidate URL is fetched, and the response body returned after verifying
   the `Content-Type` starts with `image/`.

A `DroppedImageLoaders` injection seam mirrors `PasteImageLoaders` and
`ResizeImageLoaders` from the predecessor tickets, allowing the fetch strategy
to be unit-tested without a real network.

### Modified: `apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx`

- Imports `extractDroppedImage`.
- `handleDrop`: after the existing `files.length === 1 && image` fast-path, an
  additional guard catches external drops that carry no native `files` entries
  (e.g. browser URI-list drags). The extracted `Blob` is wrapped in a synthetic
  `File`, routed through `extractPastedImage` to produce a `PastedImagePreview`,
  and handed off to `setPendingPastedImage` — the same dialog path as clipboard
  paste and intra-OS file drops.
- Intra-app @dnd-kit drags are explicitly preserved: they never populate
  `DataTransfer.files` or set `types` including `'Files'` / `'text/uri-list'`,
  so the new guard short-circuits safely.

### New: `apps/electron/src/renderer/components/app-shell/input/__tests__/extractDroppedImage.test.ts`

bun:test suite covering:
- Image File via `files` iterator → returns Blob
- Non-image File via `files` → returns null
- Directory entry (empty type) via `files` → returns null
- Empty DataTransfer → returns null
- null / undefined input → returns null
- Image File via `items` (no `files` entry) → returns Blob
- Non-image item → returns null
- `getAsFile()` returning null (directory in items) → returns null
- `files` preferred over `items` when both populated
- `text/uri-list` image URL + mocked fetch → returns Blob
- Non-image Content-Type from fetch → returns null
- Non-OK fetch response → returns null
- Comment/empty uri-list → returns null
- Non-image URL extension → returns null

## Out of scope

- ASR / voice input wiring (T239).
- Settings UI for the resize budget (future).
- Android / iOS file pickers (native platform surface, different ticket).

## Validation gates

- `bun test extractDroppedImage.test.ts` — all cases pass.
- `bun run validate:rebrand` — pass.
- `bun run validate:agent-contract` — pre-existing T223 baseline failure (unrelated).
- `bun run validate:roadmap` — pre-existing M.1.3b baseline failure (unrelated).

## Predecessors

- T237 — composer paste-image preview dialog (PR #124)
- T237b — paste-image resize/re-encode before attach (PR #161)

## Follow-ups

- T238/T239 — voice input ASR wiring
