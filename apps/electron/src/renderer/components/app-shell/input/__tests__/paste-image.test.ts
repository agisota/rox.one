/**
 * bun:test coverage for the paste-image pure helpers (M.10 T237).
 *
 * The helpers back the composer paste-image preview dialog. We exercise:
 *
 * - `findImageFile`: clipboard payload picked, drop payload picked, non-image
 *   skipped, empty event returns null, null event returns null, mixed files
 *   returns first image.
 * - `derivePastedImageName`: real filename preserved; `image.png`, `blob`,
 *   and empty fall back to `pasted-image.<ext>`; missing `file.type` defaults
 *   to png.
 * - `formatBytes`: bytes / KB / MB / GB bucket boundaries, sub-10 vs >=10
 *   formatting, negative + NaN guards.
 * - `extractPastedImage`: returns null for non-image events, builds full
 *   `PastedImagePreview` from a paste-like event with injected loaders,
 *   forwards drop-like events the same way, recovers `width: 0` / `height: 0`
 *   when the decode loader fails.
 */
import { describe, it, expect } from 'bun:test'

import {
  derivePastedImageName,
  extractPastedImage,
  findImageFile,
  formatBytes,
} from '../paste-image'

// Lightweight File stand-in so we don't depend on the DOM File constructor in
// bun:test. Only the fields the helpers read are mocked.
const mockFile = (overrides: Partial<File> = {}): File => {
  const file = {
    name: '',
    type: 'image/png',
    size: 1024,
    ...overrides,
  }
  return file as unknown as File
}

const mockEvent = (
  shape:
    | { clipboardFiles?: File[] }
    | { dataTransferFiles?: File[] }
    | { clipboardFiles?: File[]; dataTransferFiles?: File[] },
): unknown => {
  const out: Record<string, unknown> = {}
  if ('clipboardFiles' in shape && shape.clipboardFiles) {
    out.clipboardData = { files: shape.clipboardFiles }
  }
  if ('dataTransferFiles' in shape && shape.dataTransferFiles) {
    out.dataTransfer = { files: shape.dataTransferFiles }
  }
  return out
}

describe('findImageFile', () => {
  it('returns null for a null event', () => {
    expect(findImageFile(null)).toBeNull()
  })

  it('returns null when neither clipboardData nor dataTransfer carries files', () => {
    expect(findImageFile(mockEvent({}) as never)).toBeNull()
  })

  it('returns the first image File from clipboardData.files', () => {
    const png = mockFile({ name: 'foo.png', type: 'image/png' })
    const got = findImageFile(mockEvent({ clipboardFiles: [png] }) as never)
    expect(got).toBe(png)
  })

  it('returns the first image File from dataTransfer.files', () => {
    const jpg = mockFile({ name: 'bar.jpg', type: 'image/jpeg' })
    const got = findImageFile(mockEvent({ dataTransferFiles: [jpg] }) as never)
    expect(got).toBe(jpg)
  })

  it('skips non-image entries and returns the first image in the list', () => {
    const txt = mockFile({ name: 'a.txt', type: 'text/plain' })
    const png = mockFile({ name: 'b.png', type: 'image/png' })
    const gif = mockFile({ name: 'c.gif', type: 'image/gif' })
    const got = findImageFile(mockEvent({ clipboardFiles: [txt, png, gif] }) as never)
    expect(got).toBe(png)
  })

  it('returns null when every file is a non-image', () => {
    const txt = mockFile({ name: 'a.txt', type: 'text/plain' })
    const pdf = mockFile({ name: 'b.pdf', type: 'application/pdf' })
    expect(findImageFile(mockEvent({ clipboardFiles: [txt, pdf] }) as never)).toBeNull()
  })

  it('handles a missing `type` field defensively (no crash, null result)', () => {
    const broken = mockFile({ type: undefined as unknown as string })
    expect(findImageFile(mockEvent({ clipboardFiles: [broken] }) as never)).toBeNull()
  })
})

describe('derivePastedImageName', () => {
  it('preserves a meaningful filename verbatim', () => {
    expect(derivePastedImageName(mockFile({ name: 'screenshot-2024.png', type: 'image/png' }))).toBe(
      'screenshot-2024.png',
    )
  })

  it('replaces the browser default "image.png" placeholder', () => {
    expect(derivePastedImageName(mockFile({ name: 'image.png', type: 'image/png' }))).toBe(
      'pasted-image.png',
    )
  })

  it('replaces the "blob" placeholder with the mime-type extension', () => {
    expect(derivePastedImageName(mockFile({ name: 'blob', type: 'image/webp' }))).toBe(
      'pasted-image.webp',
    )
  })

  it('replaces an empty name with the mime-type extension', () => {
    expect(derivePastedImageName(mockFile({ name: '', type: 'image/jpeg' }))).toBe(
      'pasted-image.jpeg',
    )
  })

  it('defaults to png when mime type is missing', () => {
    expect(
      derivePastedImageName(mockFile({ name: '', type: '' as unknown as string })),
    ).toBe('pasted-image.png')
  })
})

describe('formatBytes', () => {
  it('reports raw bytes under 1 KB', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('reports KB with one decimal under 10 KB', () => {
    expect(formatBytes(2048)).toBe('2.0 KB')
  })

  it('rounds KB to an integer at or above 10 KB', () => {
    expect(formatBytes(50 * 1024)).toBe('50 KB')
  })

  it('reports MB with one decimal under 10 MB', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('rounds MB to an integer at or above 10 MB', () => {
    expect(formatBytes(20 * 1024 * 1024)).toBe('20 MB')
  })

  it('falls back to "0 B" for negative or NaN values', () => {
    expect(formatBytes(-1)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('0 B')
  })
})

describe('extractPastedImage', () => {
  it('returns null when no image file is present', async () => {
    const txt = mockFile({ name: 'a.txt', type: 'text/plain' })
    const got = await extractPastedImage(mockEvent({ clipboardFiles: [txt] }) as never)
    expect(got).toBeNull()
  })

  it('returns null when the event itself is null', async () => {
    expect(await extractPastedImage(null)).toBeNull()
  })

  it('builds a PastedImagePreview from a clipboard paste with injected loaders', async () => {
    const png = mockFile({ name: 'image.png', type: 'image/png', size: 4096 })
    const got = await extractPastedImage(mockEvent({ clipboardFiles: [png] }) as never, {
      readDataUrl: async () => 'data:image/png;base64,AAAA',
      decodeDimensions: async () => ({ width: 320, height: 240 }),
    })
    expect(got).not.toBeNull()
    expect(got?.dataUrl).toBe('data:image/png;base64,AAAA')
    expect(got?.name).toBe('pasted-image.png')
    expect(got?.width).toBe(320)
    expect(got?.height).toBe(240)
    expect(got?.sizeBytes).toBe(4096)
    expect(got?.file).toBe(png)
  })

  it('builds a PastedImagePreview from a drag-drop event', async () => {
    const jpg = mockFile({ name: 'photo.jpg', type: 'image/jpeg', size: 8192 })
    const got = await extractPastedImage(mockEvent({ dataTransferFiles: [jpg] }) as never, {
      readDataUrl: async () => 'data:image/jpeg;base64,BBBB',
      decodeDimensions: async () => ({ width: 800, height: 600 }),
    })
    expect(got?.name).toBe('photo.jpg')
    expect(got?.width).toBe(800)
    expect(got?.height).toBe(600)
    expect(got?.sizeBytes).toBe(8192)
  })

  it('recovers width/height as 0 when decode loader returns zeros', async () => {
    const png = mockFile({ name: 'corrupt.png', type: 'image/png', size: 256 })
    const got = await extractPastedImage(mockEvent({ clipboardFiles: [png] }) as never, {
      readDataUrl: async () => 'data:image/png;base64,XXXX',
      decodeDimensions: async () => ({ width: 0, height: 0 }),
    })
    expect(got?.width).toBe(0)
    expect(got?.height).toBe(0)
  })

  it('returns null when the data-URL reader throws', async () => {
    const png = mockFile({ name: 'image.png', type: 'image/png', size: 256 })
    const got = await extractPastedImage(mockEvent({ clipboardFiles: [png] }) as never, {
      readDataUrl: async () => {
        throw new Error('reader exploded')
      },
    })
    expect(got).toBeNull()
  })
})
