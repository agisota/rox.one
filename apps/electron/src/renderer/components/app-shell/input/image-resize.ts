/**
 * image-resize.ts (M.10 T237b)
 *
 * Optional resize / re-encode pass that runs between the
 * `PasteImagePreviewDialog`'s Confirm button and the existing
 * attachment path. When a pasted image exceeds the configured byte /
 * pixel budget, the dialog surfaces a "Resize before attach" toggle
 * (default ON); on confirm with the toggle ON we shrink the image to
 * fit `maxLongestEdgePx` while preserving aspect ratio, then
 * re-encode as JPEG at quality 0.85 to bound the attachment's
 * serialised size.
 *
 * This module is intentionally split out from `paste-image.ts` (which
 * is frozen by T237). The pure math helpers — `shouldResize`,
 * `computeTargetDimensions` — are exercised under `bun:test`; the
 * canvas-drawing path in `resizeImage` is integration-only and lives
 * behind a feature-detect that gracefully no-ops when no DOM is
 * available.
 */
import type { PastedImagePreview } from './paste-image'

/**
 * Default byte budget above which the dialog recommends resizing.
 * 2 MB matches the operator-visible budget called out in the T237b
 * spec — large enough that ordinary screenshots pass through, small
 * enough that the multi-megapixel phone-camera dumps hit the toggle.
 */
export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

/**
 * Default longest-edge cap (in pixels). 2048 px keeps Retina-quality
 * screenshots usable while clamping outsized phone-camera frames.
 */
export const DEFAULT_MAX_LONGEST_EDGE_PX = 2048

/**
 * Quality factor passed to `canvas.toDataURL('image/jpeg', ...)`. 0.85
 * is the industry-standard "visually-lossless" threshold for JPEG
 * re-encoding and keeps the resized output well under the byte budget.
 */
export const DEFAULT_JPEG_QUALITY = 0.85

/**
 * Configurable budget for {@link shouldResize}. Decoupled from the
 * raw constants so callers (the dialog, future settings UI) can swap
 * the numbers without touching the helper.
 */
export interface ResizeBudget {
  /** Byte ceiling — images at or above this size trip the toggle. */
  maxBytes: number
  /** Longest-edge pixel ceiling — images with a side above this trip the toggle. */
  maxLongestEdgePx: number
}

/** Convenience default mirroring the exported byte / pixel caps. */
export const DEFAULT_BUDGET: ResizeBudget = {
  maxBytes: DEFAULT_MAX_BYTES,
  maxLongestEdgePx: DEFAULT_MAX_LONGEST_EDGE_PX,
}

/**
 * Minimal duck-type of {@link PastedImagePreview} the predicate
 * reads. Keeping it narrow lets the unit tests pass plain objects
 * without standing up a real File.
 */
export interface ImageSizeInfo {
  width: number
  height: number
  sizeBytes: number
}

/**
 * Decide whether an image is large enough to recommend resizing.
 *
 * Returns true when either the raw byte count or the longest pixel
 * edge breaches the budget. We OR the two — a 1024x4096 strip can
 * still benefit from a downscale even at a modest byte count, and a
 * tiny 200x200 image that happens to be a 3 MB lossless PNG benefits
 * from a JPEG re-encode regardless of pixel count.
 */
export function shouldResize(
  image: ImageSizeInfo | null | undefined,
  budget: ResizeBudget = DEFAULT_BUDGET,
): boolean {
  if (image == null) return false
  const bytes = Number.isFinite(image.sizeBytes) ? image.sizeBytes : 0
  if (bytes >= budget.maxBytes) return true
  const longest = Math.max(image.width || 0, image.height || 0)
  return longest > budget.maxLongestEdgePx
}

/**
 * Compute target dimensions that fit inside `maxLongestEdgePx` while
 * preserving aspect ratio. When both sides already fit the cap the
 * input is returned verbatim; non-positive inputs are coerced to a
 * `{0, 0}` no-op so callers never see NaN.
 *
 * The result is rounded down with `Math.floor` so the output is
 * stable across browsers (some round-half-to-even, others
 * round-half-away-from-zero); we'd rather lose a pixel than risk a
 * 1-pixel discrepancy at the canvas-draw step.
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxLongestEdgePx: number,
): { width: number; height: number } {
  const w = Number.isFinite(width) && width > 0 ? width : 0
  const h = Number.isFinite(height) && height > 0 ? height : 0
  const cap = Number.isFinite(maxLongestEdgePx) && maxLongestEdgePx > 0 ? maxLongestEdgePx : 0
  if (w === 0 || h === 0 || cap === 0) return { width: w, height: h }
  const longest = Math.max(w, h)
  if (longest <= cap) return { width: w, height: h }
  const scale = cap / longest
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
  }
}

/**
 * Loader injection seam mirroring `paste-image.ts`'s
 * `PasteImageLoaders` — lets the dialog test swap in a fake decoder
 * + canvas without standing up a real DOM.
 */
export interface ResizeImageLoaders {
  /** Decode a data URL into an `HTMLImageElement`-shaped value. */
  decodeImage?: (dataUrl: string) => Promise<HTMLImageElement>
  /** Draw the decoded image at the target size and return a data URL. */
  drawToDataUrl?: (
    image: HTMLImageElement,
    target: { width: number; height: number },
    mimeType: string,
    quality: number,
  ) => string
}

/**
 * Default DOM-backed image decoder. Resolves with the loaded
 * `HTMLImageElement` or rejects when the browser fails to decode.
 */
function defaultDecodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Image constructor unavailable'))
      return
    }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image decode failed'))
    img.src = dataUrl
  })
}

/**
 * Default canvas-backed draw helper. Creates an off-screen canvas at
 * the target size, paints the image, and returns a JPEG data URL at
 * the requested quality.
 */
function defaultDrawToDataUrl(
  image: HTMLImageElement,
  target: { width: number; height: number },
  mimeType: string,
  quality: number,
): string {
  if (typeof document === 'undefined') {
    throw new Error('document unavailable')
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, target.width)
  canvas.height = Math.max(1, target.height)
  const ctx = canvas.getContext('2d')
  if (ctx == null) throw new Error('2D canvas context unavailable')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(mimeType, quality)
}

/**
 * Resize and re-encode a data URL to JPEG at the supplied target.
 *
 * The default path uses an off-screen `<canvas>`; tests inject
 * `decodeImage` / `drawToDataUrl` overrides via {@link ResizeImageLoaders}
 * so they never need a real DOM.
 */
export async function resizeImage(
  dataUrl: string,
  target: { width: number; height: number },
  loaders: ResizeImageLoaders = {},
  quality: number = DEFAULT_JPEG_QUALITY,
): Promise<string> {
  const decode = loaders.decodeImage ?? defaultDecodeImage
  const draw = loaders.drawToDataUrl ?? defaultDrawToDataUrl
  const image = await decode(dataUrl)
  return draw(image, target, 'image/jpeg', quality)
}

/**
 * One-shot wrapper used by the dialog's confirm path: when
 * {@link shouldResize} fires the dialog can call this with the live
 * {@link PastedImagePreview} and receive a fresh dataUrl + dimensions
 * to forward into the attachment flow. The original `File` is
 * preserved on the preview so the caller can still derive a name /
 * size from it.
 */
export async function resizePreviewIfNeeded(
  image: PastedImagePreview,
  budget: ResizeBudget = DEFAULT_BUDGET,
  loaders: ResizeImageLoaders = {},
): Promise<PastedImagePreview> {
  if (!shouldResize(image, budget)) return image
  const target = computeTargetDimensions(image.width, image.height, budget.maxLongestEdgePx)
  if (target.width === 0 || target.height === 0) return image
  const dataUrl = await resizeImage(dataUrl_safeguard(image.dataUrl), target, loaders)
  return {
    ...image,
    dataUrl,
    width: target.width,
    height: target.height,
    sizeBytes: estimateDataUrlBytes(dataUrl),
  }
}

/** Guard against accidentally feeding an empty data URL into the canvas. */
function dataUrl_safeguard(dataUrl: string): string {
  return typeof dataUrl === 'string' ? dataUrl : ''
}

/**
 * Estimate the byte count of a base64 data URL without round-tripping
 * through `atob`. The base64 payload is ~4/3 of the original byte
 * count; we subtract the small `data:` header to keep the estimate
 * tight. Used purely to update the dialog's size hint after resize.
 */
export function estimateDataUrlBytes(dataUrl: string): number {
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) return 0
  const commaIdx = dataUrl.indexOf(',')
  const payload = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl
  // base64 carries 6 bits per char → 6/8 = 0.75 byte per char.
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}
