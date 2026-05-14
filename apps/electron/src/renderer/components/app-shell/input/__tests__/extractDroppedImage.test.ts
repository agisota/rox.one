/**
 * bun:test coverage for extractDroppedImage (M.10 T237c).
 *
 * We cover all three DataTransfer extraction strategies:
 *   1. files[] — image File → returns Blob
 *   2. items[] — image item / getAsFile() → returns Blob  (no files entry)
 *   3. text/uri-list → mock fetch → returns Blob
 *
 * And the defensive paths:
 *   - Non-image File → returns null
 *   - Empty DataTransfer → returns null
 *   - Folder/directory entry (type === '') → returns null
 *   - null dataTransfer → returns null
 */
import { describe, it, expect } from 'bun:test'

import { extractDroppedImage } from '../extractDroppedImage'

// ── Minimal DataTransfer stubs ─────────────────────────────────────────────

function makeFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as unknown as File
}

interface StubItem {
  kind: 'file' | 'string'
  type: string
  _file: File | null
  getAsFile(): File | null
}

function makeItem(type: string, file: File | null): StubItem {
  return {
    kind: 'file',
    type,
    _file: file,
    getAsFile() { return this._file },
  }
}

function makeDataTransfer(opts: {
  files?: File[]
  items?: StubItem[]
  types?: string[]
  uriList?: string
}): DataTransfer {
  const { files = [], items = [], types, uriList } = opts
  const computedTypes = types ?? [
    ...(files.length > 0 ? ['Files'] : []),
    ...(uriList != null ? ['text/uri-list'] : []),
  ]
  return {
    files: files as unknown as FileList,
    items: items as unknown as DataTransferItemList,
    types: computedTypes,
    getData(format: string) {
      if (format === 'text/uri-list' && uriList != null) return uriList
      return ''
    },
  } as unknown as DataTransfer
}

// ── Strategy 1: DataTransfer.files ────────────────────────────────────────

describe('extractDroppedImage — strategy 1: files', () => {
  it('returns a Blob when the first File is an image', async () => {
    const imageFile = makeFile('photo.png', 'image/png', 2048)
    const dt = makeDataTransfer({ files: [imageFile] })
    const result = await extractDroppedImage(dt)
    expect(result).not.toBeNull()
    expect((result as unknown as File).type).toBe('image/png')
  })

  it('skips non-image Files and returns null when no image found', async () => {
    const textFile = makeFile('readme.txt', 'text/plain', 512)
    const dt = makeDataTransfer({ files: [textFile] })
    const result = await extractDroppedImage(dt)
    expect(result).toBeNull()
  })

  it('returns null for a directory entry (type is empty string)', async () => {
    // Folder drops appear as a File with an empty MIME type
    const folderEntry = makeFile('MyFolder', '', 0)
    const dt = makeDataTransfer({ files: [folderEntry] })
    const result = await extractDroppedImage(dt)
    expect(result).toBeNull()
  })

  it('returns null for an empty DataTransfer', async () => {
    const dt = makeDataTransfer({})
    const result = await extractDroppedImage(dt)
    expect(result).toBeNull()
  })

  it('returns null for null input', async () => {
    const result = await extractDroppedImage(null)
    expect(result).toBeNull()
  })

  it('returns null for undefined input', async () => {
    const result = await extractDroppedImage(undefined)
    expect(result).toBeNull()
  })
})

// ── Strategy 2: DataTransfer.items ────────────────────────────────────────

describe('extractDroppedImage — strategy 2: items (no files entry)', () => {
  it('returns a Blob when items contains an image/jpeg entry', async () => {
    const imageFile = makeFile('snapshot.jpg', 'image/jpeg', 4096)
    const item = makeItem('image/jpeg', imageFile)
    const dt = makeDataTransfer({ files: [], items: [item], types: ['Files'] })
    const result = await extractDroppedImage(dt)
    expect(result).not.toBeNull()
    expect((result as unknown as File).type).toBe('image/jpeg')
  })

  it('returns null when items only contains non-image entries', async () => {
    const pdfFile = makeFile('document.pdf', 'application/pdf', 8192)
    const item = makeItem('application/pdf', pdfFile)
    const dt = makeDataTransfer({ files: [], items: [item], types: ['Files'] })
    const result = await extractDroppedImage(dt)
    expect(result).toBeNull()
  })

  it('returns null when getAsFile() returns null (directory)', async () => {
    const item = makeItem('image/png', null) // getAsFile() → null for directories
    const dt = makeDataTransfer({ files: [], items: [item], types: ['Files'] })
    const result = await extractDroppedImage(dt)
    expect(result).toBeNull()
  })

  it('prefers files over items when both are populated', async () => {
    const fileFromFiles = makeFile('from-files.webp', 'image/webp', 1024)
    const fileFromItems = makeFile('from-items.png', 'image/png', 2048)
    const item = makeItem('image/png', fileFromItems)
    const dt = makeDataTransfer({ files: [fileFromFiles], items: [item], types: ['Files'] })
    const result = await extractDroppedImage(dt)
    expect(result).not.toBeNull()
    expect((result as unknown as File).name).toBe('from-files.webp')
  })
})

// ── Strategy 3: text/uri-list ─────────────────────────────────────────────

describe('extractDroppedImage — strategy 3: text/uri-list', () => {
  function makeFetchMock(blob: Blob | null, contentType = 'image/png') {
    return async (_url: string) => ({
      ok: blob != null,
      headers: { get: (name: string) => (name === 'content-type' ? contentType : null) },
      blob: async () => blob as Blob,
    })
  }

  it('fetches and returns Blob for a valid image URL in uri-list', async () => {
    const fakeBlob = new Blob(['png-bytes'], { type: 'image/png' })
    const dt = makeDataTransfer({ uriList: 'https://example.com/photo.png' })
    const result = await extractDroppedImage(dt, { fetchUrl: makeFetchMock(fakeBlob) })
    expect(result).toBe(fakeBlob)
  })

  it('returns null when the fetched resource is not an image content-type', async () => {
    const fakeBlob = new Blob(['<html>'], { type: 'text/html' })
    const dt = makeDataTransfer({ uriList: 'https://example.com/photo.png' })
    const result = await extractDroppedImage(dt, { fetchUrl: makeFetchMock(fakeBlob, 'text/html') })
    expect(result).toBeNull()
  })

  it('returns null when the fetch response is not ok', async () => {
    const dt = makeDataTransfer({ uriList: 'https://example.com/photo.png' })
    const result = await extractDroppedImage(dt, { fetchUrl: makeFetchMock(null) })
    expect(result).toBeNull()
  })

  it('skips comment lines and returns null for an empty uri-list', async () => {
    const dt = makeDataTransfer({ uriList: '# this is a comment\n\n' })
    const result = await extractDroppedImage(dt)
    expect(result).toBeNull()
  })

  it('ignores non-image URLs even if server would serve them', async () => {
    const fakeBlob = new Blob(['not-an-image'], { type: 'text/plain' })
    const dt = makeDataTransfer({ uriList: 'https://example.com/file.txt' })
    const result = await extractDroppedImage(dt, { fetchUrl: makeFetchMock(fakeBlob, 'text/plain') })
    expect(result).toBeNull()
  })
})
