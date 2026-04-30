export const PDF_ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

export type PdfZoomDirection = 'in' | 'out'

export function clampPdfPage(page: number, numPages: number): number {
  const safeTotal = Math.max(1, Math.floor(Number.isFinite(numPages) ? numPages : 1))
  const safePage = Math.floor(Number.isFinite(page) ? page : 1)
  return Math.min(safeTotal, Math.max(1, safePage))
}

export function getPdfPageLabel(page: number, numPages: number): string {
  const safeTotal = Math.max(1, Math.floor(Number.isFinite(numPages) ? numPages : 1))
  return `${clampPdfPage(page, safeTotal)} / ${safeTotal}`
}

export function stepPdfZoom(currentScale: number, direction: PdfZoomDirection): number {
  const safeScale = Number.isFinite(currentScale) ? currentScale : 1
  const minScale = PDF_ZOOM_PRESETS[0]!
  const maxScale = PDF_ZOOM_PRESETS[PDF_ZOOM_PRESETS.length - 1]!
  if (direction === 'in') {
    return PDF_ZOOM_PRESETS.find(scale => scale > safeScale) ?? maxScale
  }

  return [...PDF_ZOOM_PRESETS].reverse().find(scale => scale < safeScale) ?? minScale
}

export function getPdfZoomLabel(scale: number): string {
  const safeScale = Number.isFinite(scale) ? scale : 1
  return `${Math.round(safeScale * 100)}%`
}
