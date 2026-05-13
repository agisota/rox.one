/**
 * RTL coverage for PasteImagePreviewDialog.tsx (M.10 T237).
 *
 * Cases covered:
 *   - Closed when `open={false}` (no DOM, no onConfirm)
 *   - Open with a preview renders thumbnail, name, dimensions row
 *   - Confirm button fires `onConfirm` and closes the dialog
 *   - Cancel button fires `onCancel` and closes the dialog
 *   - `image={null}` keeps the dialog closed even when `open=true`
 *   - Hides dimensions row when width/height are 0 (decode failure)
 *   - Size hint always rendered (with or without dimensions)
 */
import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'

import { PasteImagePreviewDialog } from '../PasteImagePreviewDialog'
import { ModalProvider } from '../../../../context/ModalContext'

// Lightweight i18n stub — return the key + serialised vars so we can assert
// on dimensions row formatting without booting i18next.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}|${JSON.stringify(vars)}` : key,
  }),
}))

const Providers = ({ children }: { children: React.ReactNode }) => (
  <ModalProvider>{children}</ModalProvider>
)

afterEach(() => {
  cleanup()
})

const baseImage = {
  dataUrl: 'data:image/png;base64,IMG',
  name: 'screenshot.png',
  width: 1024,
  height: 768,
  sizeBytes: 4096,
}

describe('PasteImagePreviewDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Providers>
        <PasteImagePreviewDialog
          open={false}
          image={baseImage}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    expect(screen.queryByTestId('composer-paste-image-preview-dialog')).toBeNull()
  })

  it('renders the dialog, thumbnail, name, and dimensions row when open with an image', () => {
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={baseImage}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    expect(screen.getByTestId('composer-paste-image-preview-dialog')).not.toBeNull()
    const thumb = screen.getByTestId('composer-paste-image-preview-thumbnail')
    const img = thumb.querySelector('img')
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,IMG')
    expect(img?.getAttribute('alt')).toBe('screenshot.png')
    expect(screen.getByTestId('composer-paste-image-preview-name').textContent).toBe(
      'screenshot.png',
    )
    const dims = screen.getByTestId('composer-paste-image-preview-dimensions').textContent ?? ''
    expect(dims).toContain('workbench.composer.pasteImage.dimensions')
    expect(dims).toContain('"width":1024')
    expect(dims).toContain('"height":768')
    expect(dims).toContain('"size":"4.0 KB"')
  })

  it('fires onConfirm and closes when Confirm is clicked', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const onCancel = vi.fn()
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={baseImage}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </Providers>,
    )
    fireEvent.click(screen.getByTestId('composer-paste-image-preview-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel and closes when Cancel is clicked', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const onCancel = vi.fn()
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={baseImage}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </Providers>,
    )
    fireEvent.click(screen.getByTestId('composer-paste-image-preview-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('keeps the dialog closed when image is null even if open=true', () => {
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={null}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    expect(screen.queryByTestId('composer-paste-image-preview-dialog')).toBeNull()
  })

  it('hides the dimensions row and shows a size-only line when width/height are 0', () => {
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={{ ...baseImage, width: 0, height: 0, sizeBytes: 256 }}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    expect(screen.queryByTestId('composer-paste-image-preview-dimensions')).toBeNull()
    expect(screen.getByTestId('composer-paste-image-preview-size').textContent).toBe('256 B')
  })
})
