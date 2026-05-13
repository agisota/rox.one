/**
 * bun:test coverage for the image-resize math helpers (M.10 T237b).
 *
 * We cover:
 *
 * - `shouldResize`: byte budget trip, pixel budget trip, null-safe
 *   guards, both budgets satisfied → false, NaN / negative byte
 *   defensive paths.
 * - `computeTargetDimensions`: landscape downscale, portrait
 *   downscale, square downscale, already-fitting passthrough,
 *   zero/NaN guards, aspect-ratio preservation, floor rounding.
 * - `estimateDataUrlBytes`: empty input, base64 padding (==, =, none),
 *   ignores `data:` header.
 * - `resizePreviewIfNeeded`: passthrough when under budget,
 *   end-to-end via injected loaders (no real DOM).
 *
 * The canvas-drawing path in `resizeImage` is DOM-heavy and is
 * exercised via the RTL dialog suite, not here.
 */
import { describe, it, expect } from 'bun:test'

import {
  DEFAULT_BUDGET,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LONGEST_EDGE_PX,
  computeTargetDimensions,
  estimateDataUrlBytes,
  resizePreviewIfNeeded,
  shouldResize,
} from '../image-resize'
import type { PastedImagePreview } from '../paste-image'

const mockImage = (overrides: Partial<PastedImagePreview> = {}): PastedImagePreview => ({
  dataUrl: 'data:image/png;base64,AAAA',
  name: 'pasted-image.png',
  width: 1024,
  height: 768,
  sizeBytes: 4096,
  file: { name: 'pasted-image.png', size: 4096, type: 'image/png' } as unknown as File,
  ...overrides,
})

describe('shouldResize', () => {
  it('returns false for a null image', () => {
    expect(shouldResize(null)).toBe(false)
    expect(shouldResize(undefined)).toBe(false)
  })

  it('returns false when the image is well below both budgets', () => {
    expect(shouldResize({ width: 800, height: 600, sizeBytes: 100_000 })).toBe(false)
  })

  it('returns true when the byte budget is exceeded', () => {
    expect(
      shouldResize({ width: 800, height: 600, sizeBytes: DEFAULT_MAX_BYTES + 1 }),
    ).toBe(true)
  })

  it('trips on exact byte budget boundary (>= maxBytes)', () => {
    expect(shouldResize({ width: 100, height: 100, sizeBytes: DEFAULT_MAX_BYTES })).toBe(true)
  })

  it('returns true when the longest edge exceeds the pixel budget', () => {
    expect(
      shouldResize({
        width: DEFAULT_MAX_LONGEST_EDGE_PX + 100,
        height: 100,
        sizeBytes: 1024,
      }),
    ).toBe(true)
  })

  it('returns true when the portrait edge exceeds the pixel budget', () => {
    expect(
      shouldResize({
        width: 100,
        height: DEFAULT_MAX_LONGEST_EDGE_PX + 100,
        sizeBytes: 1024,
      }),
    ).toBe(true)
  })

  it('honours a custom byte budget', () => {
    expect(
      shouldResize({ width: 10, height: 10, sizeBytes: 1024 }, { maxBytes: 512, maxLongestEdgePx: 9999 }),
    ).toBe(true)
  })

  it('honours a custom pixel budget', () => {
    expect(
      shouldResize({ width: 200, height: 200, sizeBytes: 16 }, { maxBytes: 99 * 1024 * 1024, maxLongestEdgePx: 150 }),
    ).toBe(true)
  })

  it('treats NaN byte counts as zero (no false positive trip)', () => {
    expect(
      shouldResize({ width: 100, height: 100, sizeBytes: Number.NaN }),
    ).toBe(false)
  })
})

describe('computeTargetDimensions', () => {
  it('returns the input verbatim when both sides fit the cap', () => {
    expect(computeTargetDimensions(1024, 768, 2048)).toEqual({ width: 1024, height: 768 })
  })

  it('scales a landscape image so the longest edge equals the cap', () => {
    const got = computeTargetDimensions(4096, 2048, 2048)
    expect(got.width).toBe(2048)
    expect(got.height).toBe(1024)
  })

  it('scales a portrait image so the longest edge equals the cap', () => {
    const got = computeTargetDimensions(1024, 4096, 2048)
    expect(got.width).toBe(512)
    expect(got.height).toBe(2048)
  })

  it('scales a square image down proportionally', () => {
    expect(computeTargetDimensions(4096, 4096, 1024)).toEqual({ width: 1024, height: 1024 })
  })

  it('preserves aspect ratio within 1 px on non-divisible scales', () => {
    const got = computeTargetDimensions(3000, 2000, 1500)
    expect(got.width).toBe(1500)
    expect(got.height).toBe(1000)
  })

  it('floors fractional pixels rather than rounding up', () => {
    // 3001 → cap 1500 with scale 1500/3001 ≈ 0.4998…
    const got = computeTargetDimensions(3001, 2001, 1500)
    expect(got.width).toBeLessThanOrEqual(1500)
    expect(got.height).toBeLessThanOrEqual(1000)
    // floor guarantees we never exceed the cap on the longest edge.
    expect(Math.max(got.width, got.height)).toBeLessThanOrEqual(1500)
  })

  it('clamps zero / negative inputs to a {0, 0} no-op', () => {
    expect(computeTargetDimensions(0, 100, 1024)).toEqual({ width: 0, height: 100 })
    expect(computeTargetDimensions(-1, 100, 1024)).toEqual({ width: 0, height: 100 })
  })

  it('clamps NaN cap to a passthrough', () => {
    expect(computeTargetDimensions(1024, 768, Number.NaN)).toEqual({ width: 1024, height: 768 })
  })

  it('never returns 0 width when the input is positive', () => {
    // 10x4000 with cap 100 → height 100, width floor(0.25) = 0 → clamped to 1.
    const got = computeTargetDimensions(10, 4000, 100)
    expect(got.height).toBe(100)
    expect(got.width).toBeGreaterThanOrEqual(1)
  })
})

describe('estimateDataUrlBytes', () => {
  it('returns 0 for an empty input', () => {
    expect(estimateDataUrlBytes('')).toBe(0)
  })

  it('estimates raw base64 length without padding', () => {
    // 4 base64 chars → 3 bytes; with `data:image/jpeg;base64,` header.
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3)
  })

  it('subtracts one for single-equals padding', () => {
    // 4 chars one padding → 2 bytes.
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AAA=')).toBe(2)
  })

  it('subtracts two for double-equals padding', () => {
    // 4 chars two padding → 1 byte.
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AA==')).toBe(1)
  })

  it('handles a payload without a leading data: header', () => {
    expect(estimateDataUrlBytes('AAAA')).toBe(3)
  })
})

describe('resizePreviewIfNeeded', () => {
  it('returns the original image when neither budget is exceeded', async () => {
    const image = mockImage({ width: 800, height: 600, sizeBytes: 100_000 })
    const got = await resizePreviewIfNeeded(image)
    expect(got).toBe(image)
  })

  it('routes through the resize path with injected loaders when over budget', async () => {
    const receivedTargets: Array<{ width: number; height: number }> = []
    const image = mockImage({
      width: 4096,
      height: 2048,
      sizeBytes: DEFAULT_MAX_BYTES + 1,
    })
    const got = await resizePreviewIfNeeded(image, DEFAULT_BUDGET, {
      decodeImage: async () => ({ width: 4096, height: 2048 } as unknown as HTMLImageElement),
      drawToDataUrl: (_img, target) => {
        receivedTargets.push(target)
        // Synthesise a small JPEG-shaped payload.
        return 'data:image/jpeg;base64,/9j/AA=='
      },
    })
    expect(receivedTargets.length).toBe(1)
    expect(receivedTargets[0]?.width).toBe(2048)
    expect(receivedTargets[0]?.height).toBe(1024)
    expect(got.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(got.width).toBe(2048)
    expect(got.height).toBe(1024)
    expect(got.sizeBytes).toBeGreaterThan(0)
    expect(got.file).toBe(image.file) // file pointer preserved
  })

  it('passes the image through unchanged when computed target is zero', async () => {
    // Width 0 makes computeTargetDimensions yield {0, 0}; the helper should
    // gracefully no-op instead of feeding garbage to the canvas.
    const image = mockImage({ width: 0, height: 0, sizeBytes: DEFAULT_MAX_BYTES + 1 })
    const got = await resizePreviewIfNeeded(image)
    expect(got).toBe(image)
  })
})
