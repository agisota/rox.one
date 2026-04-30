import { describe, expect, it } from 'bun:test'
import {
  clampPdfPage,
  getPdfPageLabel,
  getPdfZoomLabel,
  stepPdfZoom,
} from '../pdf-viewer-state'

describe('pdf viewer state', () => {
  it('clamps page numbers to the loaded document range', () => {
    expect(clampPdfPage(0, 4)).toBe(1)
    expect(clampPdfPage(3, 4)).toBe(3)
    expect(clampPdfPage(7, 4)).toBe(4)
    expect(clampPdfPage(2, 0)).toBe(1)
  })

  it('formats page labels without exposing invalid zero-page documents', () => {
    expect(getPdfPageLabel(2, 5)).toBe('2 / 5')
    expect(getPdfPageLabel(2, 0)).toBe('1 / 1')
  })

  it('steps zoom through bounded presets', () => {
    expect(stepPdfZoom(1, 'in')).toBe(1.25)
    expect(stepPdfZoom(1, 'out')).toBe(0.75)
    expect(stepPdfZoom(4, 'in')).toBe(4)
    expect(stepPdfZoom(0.25, 'out')).toBe(0.25)
  })

  it('formats zoom labels as whole percentages', () => {
    expect(getPdfZoomLabel(1)).toBe('100%')
    expect(getPdfZoomLabel(1.25)).toBe('125%')
  })
})
