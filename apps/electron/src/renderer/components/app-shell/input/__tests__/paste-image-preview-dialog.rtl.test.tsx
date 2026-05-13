/**
 * RTL coverage for PasteImagePreviewDialog.tsx (M.10 T237 + T237b).
 *
 * Cases covered:
 *   - Closed when `open={false}` (no DOM, no onConfirm)
 *   - Open with a preview renders thumbnail, name, dimensions row
 *   - Confirm button fires `onConfirm` and closes the dialog
 *   - Cancel button fires `onCancel` and closes the dialog
 *   - `image={null}` keeps the dialog closed even when `open=true`
 *   - Hides dimensions row when width/height are 0 (decode failure)
 *   - Size hint always rendered (with or without dimensions)
 *   - T237b: Resize toggle hidden when image is under the budget
 *   - T237b: Resize toggle shown + default ON when byte budget tripped
 *   - T237b: Resize toggle shown + default ON when pixel budget tripped
 *   - T237b: Toggle off → onConfirm receives `{resize: false}`
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

  // T237b: resize toggle cases.

  it('does not show the resize row when the image is under the budget', () => {
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
    expect(screen.queryByTestId('composer-paste-image-preview-resize-row')).toBeNull()
  })

  it('shows the resize toggle (default ON) when the byte budget is tripped', () => {
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={{ ...baseImage, sizeBytes: 5 * 1024 * 1024 }}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    expect(screen.getByTestId('composer-paste-image-preview-resize-row')).not.toBeNull()
    const sw = screen.getByTestId('composer-paste-image-preview-resize-switch')
    // Radix Switch reflects state via aria-checked.
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  it('shows the resize hint with the computed target dimensions when pixel budget is tripped', () => {
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={{ ...baseImage, width: 4096, height: 2048, sizeBytes: 1024 }}
          onOpenChange={() => undefined}
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    expect(screen.getByTestId('composer-paste-image-preview-resize-row')).not.toBeNull()
    const hint = screen.getByTestId('composer-paste-image-preview-resize-hint').textContent ?? ''
    expect(hint).toContain('workbench.composer.pasteImage.resizeHint')
    // Target for 4096x2048 with cap 2048 → 2048x1024.
    expect(hint).toContain('"width":2048')
    expect(hint).toContain('"height":1024')
  })

  it('forwards `resize: true` on confirm when the toggle is left ON', () => {
    const onConfirm = vi.fn()
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={{ ...baseImage, sizeBytes: 5 * 1024 * 1024 }}
          onOpenChange={() => undefined}
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    fireEvent.click(screen.getByTestId('composer-paste-image-preview-confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith({ resize: true })
  })

  it('forwards `resize: false` on confirm after the user disables the toggle', () => {
    const onConfirm = vi.fn()
    render(
      <Providers>
        <PasteImagePreviewDialog
          open
          image={{ ...baseImage, sizeBytes: 5 * 1024 * 1024 }}
          onOpenChange={() => undefined}
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />
      </Providers>,
    )
    // Click the switch to toggle off, then confirm.
    fireEvent.click(screen.getByTestId('composer-paste-image-preview-resize-switch'))
    fireEvent.click(screen.getByTestId('composer-paste-image-preview-confirm'))
    expect(onConfirm).toHaveBeenCalledWith({ resize: false })
  })
})
