/**
 * paste-image.ts (M.10 T237)
 *
 * Pure, framework-agnostic helper backing the composer paste-image preview
 * dialog. When a user pastes (Cmd/Ctrl+V) or drops an image into the
 * FreeFormInput, the composer wraps the existing attachment path with a
 * preview step that surfaces filename, dimensions, and a Confirm/Cancel
 * gate before the image becomes an attachment.
 *
 * This module is intentionally DOM-light so the extractor can be unit-tested
 * in isolation under `bun:test`. The extractor accepts either a
 * `ClipboardEvent` (paste) or a `DragEvent` (drag-drop) and returns a
 * lightweight preview descriptor, or `null` when no image is found.
 *
 * The dialog and FreeFormInput wiring live in companion files
 * (`PasteImagePreviewDialog.tsx` + `FreeFormInput.tsx` extension).
 */

/**
 * The preview descriptor the dialog and confirm-handler consume. We carry the
 * raw `File` so the existing `readFileAsAttachment` path can take it from
 * here unchanged on confirm; the `dataUrl` / `name` / `width` / `height` /
 * `sizeBytes` keys are what the dialog renders for the human-visible preview.
 */
export interface PastedImagePreview {
  /** Data URL suitable for an `<img src>` preview thumbnail in the dialog. */
  dataUrl: string
  /** Display name. Falls back to `pasted-image.<ext>` when the source File has no usable name. */
  name: string
  /** Decoded intrinsic width in pixels (0 when decode fails — dialog hides dimensions in that case). */
  width: number
  /** Decoded intrinsic height in pixels (0 when decode fails). */
  height: number
  /** Raw byte size of the underlying File. */
  sizeBytes: number
  /** Underlying File handed off to `readFileAsAttachment` on confirm. */
  file: File
}

/**
 * Minimal duck-typed view of `ClipboardEvent` / `DragEvent` so the extractor
 * works under bun:test's lighter DOM. We only need `.clipboardData.files`
 * (paste) or `.dataTransfer.files` (drag-drop), so we keep the contract
 * narrow.
 */
type PasteOrDropLike =
  | { clipboardData?: { files?: ArrayLike<File> | null } | null }
  | { dataTransfer?: { files?: ArrayLike<File> | null } | null }

/**
 * Pull the first image File out of a paste/drop event, regardless of which
 * event type it is. Returns `null` when neither slot carries one.
 */
export function findImageFile(
  event: PasteOrDropLike | null | undefined,
): File | null {
  if (event == null) return null
  const slots: ArrayLike<File>[] = []
  const clip = (event as { clipboardData?: { files?: ArrayLike<File> | null } | null })
    .clipboardData
  if (clip?.files && clip.files.length > 0) slots.push(clip.files)
  const drop = (event as { dataTransfer?: { files?: ArrayLike<File> | null } | null })
    .dataTransfer
  if (drop?.files && drop.files.length > 0) slots.push(drop.files)

  for (const slot of slots) {
    for (let i = 0; i < slot.length; i += 1) {
      const file = slot[i]
      if (file != null && typeof file.type === 'string' && file.type.startsWith('image/')) {
        return file
      }
    }
  }
  return null
}

/**
 * Derive a stable filename for the pasted image. Browsers sometimes hand us
 * `image.png` / `blob` / empty for clipboard payloads — we fall back to a
 * `pasted-image.<ext>` placeholder so the dialog has something meaningful to
 * render. Real OS drag-drops keep their original filename.
 *
 * @param file - the source File from the paste/drop event
 * @returns the display name the dialog should show; the FreeFormInput
 *          attachment path may still re-number it via `getNextPastedNumber`.
 */
export function derivePastedImageName(file: File): string {
  const raw = typeof file.name === 'string' ? file.name : ''
  if (raw && raw !== 'image.png' && raw !== 'image.jpg' && raw !== 'blob') {
    return raw
  }
  const ext = typeof file.type === 'string' && file.type.includes('/')
    ? file.type.split('/')[1] || 'png'
    : 'png'
  return `pasted-image.${ext}`
}

/**
 * Format `sizeBytes` for the dialog's "{{width}} × {{height}} ({{size}})"
 * dimensions row. Kept locale-stable (KB / MB / GB) since the unit suffix is
 * universal in this codebase's existing AttachmentPreview surface.
 *
 * @param bytes - raw byte count from `File.size`
 * @returns a short string like "12 KB" / "1.4 MB"
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(2) : gb.toFixed(1)} GB`
}

/**
 * Read a File as a data URL using FileReader. Wrapped as a Promise so the
 * extractor can be awaited directly.
 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      resolve(typeof result === 'string' ? result : '')
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(file)
  })
}

/**
 * Decode a data URL into an `HTMLImageElement` so we can read `naturalWidth` /
 * `naturalHeight`. Returns `{ width: 0, height: 0 }` on failure rather than
 * throwing — the dialog hides the dimensions row when both are zero.
 */
function decodeDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    // In bun:test we don't have a real Image constructor — the test stubs
    // `extractPastedImage` with an injected loader, so this path is only
    // exercised in the browser.
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 })
      return
    }
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = dataUrl
  })
}

/**
 * Loader injection seam for tests. Production code uses the default
 * FileReader + Image pair; tests stub these.
 */
export interface PasteImageLoaders {
  readDataUrl?: (file: File) => Promise<string>
  decodeDimensions?: (dataUrl: string) => Promise<{ width: number; height: number }>
}

/**
 * Extract a `PastedImagePreview` from a paste or drop event.
 *
 * @param event - the React-or-native ClipboardEvent / DragEvent
 * @param loaders - optional FileReader / Image overrides for tests
 * @returns the preview descriptor, or `null` when no image is in the event
 */
export async function extractPastedImage(
  event: PasteOrDropLike | null | undefined,
  loaders: PasteImageLoaders = {},
): Promise<PastedImagePreview | null> {
  const file = findImageFile(event)
  if (file == null) return null

  const readUrl = loaders.readDataUrl ?? readAsDataUrl
  const decode = loaders.decodeDimensions ?? decodeDimensions

  let dataUrl = ''
  try {
    dataUrl = await readUrl(file)
  } catch {
    return null
  }

  const dims = await decode(dataUrl)

  return {
    dataUrl,
    name: derivePastedImageName(file),
    width: dims.width,
    height: dims.height,
    sizeBytes: typeof file.size === 'number' ? file.size : 0,
    file,
  }
}
