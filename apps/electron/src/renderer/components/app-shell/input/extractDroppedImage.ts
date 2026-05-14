/**
 * extractDroppedImage.ts (M.10 T237c)
 *
 * Parses a `DataTransfer` object (from an OS drag-and-drop event) and
 * returns the first image it finds as a `Blob`. This is the external-app
 * counterpart to the clipboard-paste path in `paste-image.ts`.
 *
 * Three extraction strategies are tried in order:
 *
 *   1. `DataTransfer.files` — best path for macOS Finder, Windows Explorer,
 *      and most file-manager drops. Each `File` in the list is checked for
 *      an `image/*` MIME type; the first match is returned.
 *
 *   2. `DataTransfer.items` — fallback for browsers that populate `items`
 *      but not `files` (rare in Electron, but covered for completeness).
 *      Only `DataTransferItem` entries with `kind === 'file'` and an
 *      `image/*` type are considered; `getAsFile()` is called and the
 *      first non-null result is returned.
 *
 *   3. `text/uri-list` / `text/x-moz-url` string data — some browsers
 *      (especially when dragging an image from a web page) supply the
 *      image URL as a text item instead of embedding the binary. We parse
 *      the URI list, pick the first `http(s)://` URL that ends in a
 *      recognised image extension (or whose path component looks like an
 *      image), fetch the resource, and return the response body as a Blob
 *      after verifying its `Content-Type` starts with `image/`.
 *
 * Intra-app drag-and-drop (via @dnd-kit PointerSensor) never sets
 * `DataTransfer.files` — it operates purely through pointer events with no
 * DataTransfer payload. The caller (`FreeFormInput.handleDrop`) is
 * responsible for detecting that case first (e.g., checking for a custom
 * MIME marker or testing `files.length === 0` with types not including
 * `"Files"`) and short-circuiting before calling this helper.
 *
 * @returns `Promise<Blob | null>` — `null` when no suitable image is found
 *   or an error occurs during extraction. Never rejects.
 */

/** Image MIME type prefix we accept. */
const IMAGE_PREFIX = 'image/'

/** Image URL path extensions we accept for the URI-list strategy. */
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|avif|tiff?|ico)(\?.*)?$/i

/**
 * Check whether a MIME string represents an image we should accept.
 * We accept any `image/*` MIME type to stay forward-compatible with
 * new formats (avif, jxl, etc.).
 */
function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === 'string' && mime.startsWith(IMAGE_PREFIX)
}

/**
 * Loader injection seam — lets unit tests stub `fetch` without patching
 * the global. Production code passes `undefined` to use the real fetch.
 */
export interface DroppedImageLoaders {
  /**
   * Override the network fetch used for the URI-list strategy.
   * Must return a Response-like object with `ok`, `headers.get()`,
   * and `blob()`.
   */
  fetchUrl?: (url: string) => Promise<{
    ok: boolean
    headers: { get(name: string): string | null }
    blob(): Promise<Blob>
  }>
}

/**
 * Extract the first image from a `DataTransfer` using three strategies:
 * files → items → uri-list.
 *
 * @param dataTransfer — the `DragEvent.dataTransfer` (or a test stub)
 * @param loaders — optional fetch override for unit tests
 * @returns a `Blob` of the first image found, or `null`
 */
export async function extractDroppedImage(
  dataTransfer: DataTransfer | null | undefined,
  loaders: DroppedImageLoaders = {},
): Promise<Blob | null> {
  if (dataTransfer == null) return null

  // ── Strategy 1: DataTransfer.files ─────────────────────────────────────
  // Standard path for OS file-manager drops. Folder entries appear here too
  // but have an empty `type` string, so the isImageMime check weeds them out.
  const filesArray = dataTransfer.files ? Array.from(dataTransfer.files) : []
  for (const file of filesArray) {
    if (isImageMime(file.type)) {
      return file
    }
  }

  // ── Strategy 2: DataTransfer.items ─────────────────────────────────────
  // Fallback for when `files` is empty or unpopulated. We only look at
  // items with kind === 'file' and an image MIME type; non-file items
  // (kind === 'string') are skipped entirely.
  const itemsArray = dataTransfer.items ? Array.from(dataTransfer.items) : []
  for (const item of itemsArray) {
    if (item.kind === 'file' && isImageMime(item.type)) {
      const file = item.getAsFile()
      if (file != null) {
        return file
      }
    }
  }

  // ── Strategy 3: text/uri-list / text/x-moz-url ─────────────────────────
  // Some browsers (Firefox, web-to-app drags) expose dragged images as a
  // URL rather than embedding the binary. We fetch the URL and verify the
  // response Content-Type before returning.
  const uriList = getUriListData(dataTransfer)
  if (uriList) {
    const urls = parseUriList(uriList)
    for (const url of urls) {
      const blob = await fetchImageBlob(url, loaders.fetchUrl)
      if (blob != null) return blob
    }
  }

  return null
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Return the first URI-list string from the DataTransfer, checking both
 * `text/uri-list` (standard) and `text/x-moz-url` (Firefox-specific).
 */
function getUriListData(dt: DataTransfer): string | null {
  if (dt.types.includes('text/uri-list')) {
    const val = dt.getData('text/uri-list')
    if (val) return val
  }
  if (dt.types.includes('text/x-moz-url')) {
    const val = dt.getData('text/x-moz-url')
    if (val) return val
  }
  return null
}

/**
 * Parse an RFC 2483 URI list: lines starting with `#` are comments; empty
 * lines are ignored; only `http://` and `https://` URIs that look like
 * image resources are returned.
 *
 * `text/x-moz-url` interleaves URLs and titles on alternate lines; we
 * simply pick every line and filter by scheme, so titles (which start with
 * human text) are naturally discarded.
 */
function parseUriList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'))
    .filter(line => /^https?:\/\//i.test(line))
    .filter(line => IMAGE_EXTENSIONS.test(new URL(line).pathname) || isImageMime(guessMimeFromUrl(line)))
}

/**
 * Very lightweight MIME guess from a URL's path extension. Returns an
 * `image/*` string when the extension is recognisable, otherwise `null`.
 * Used to filter URI-list entries that look like images before we pay the
 * cost of a network fetch.
 */
function guessMimeFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.toLowerCase()
    if (path.endsWith('.png')) return 'image/png'
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
    if (path.endsWith('.gif')) return 'image/gif'
    if (path.endsWith('.webp')) return 'image/webp'
    if (path.endsWith('.svg')) return 'image/svg+xml'
    if (path.endsWith('.bmp')) return 'image/bmp'
    if (path.endsWith('.avif')) return 'image/avif'
    if (path.endsWith('.tif') || path.endsWith('.tiff')) return 'image/tiff'
    if (path.endsWith('.ico')) return 'image/x-icon'
  } catch {
    // malformed URL — fall through
  }
  return null
}

/**
 * Fetch a URL and return its body as a `Blob` when the server reports an
 * `image/*` Content-Type. Returns `null` on network error, non-OK status,
 * or non-image content type. Never throws.
 */
async function fetchImageBlob(
  url: string,
  fetchFn: DroppedImageLoaders['fetchUrl'],
): Promise<Blob | null> {
  try {
    const doFetch = fetchFn ?? ((u: string) => fetch(u))
    const res = await doFetch(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!isImageMime(ct.split(';')[0].trim())) return null
    return await res.blob()
  } catch {
    return null
  }
}
