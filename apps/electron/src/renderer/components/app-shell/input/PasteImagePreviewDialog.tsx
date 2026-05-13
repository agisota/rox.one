/**
 * PasteImagePreviewDialog.tsx (M.10 T237)
 *
 * Surfaced by the composer when an image is pasted (Cmd/Ctrl+V) or dropped
 * into the FreeFormInput. The dialog shows a thumbnail of the pasted image,
 * its filename, intrinsic dimensions, and a byte-size hint, with Confirm /
 * Cancel buttons. On confirm the image is forwarded through the existing
 * `readFileAsAttachment` path and becomes a composer attachment; on cancel
 * the paste is dropped.
 *
 * The dialog is intentionally thin: it doesn't own the image's lifecycle —
 * the caller does — it just renders the preview and wires Confirm / Cancel
 * back to the host. All copy goes through `react-i18next` against the
 * `workbench.composer.pasteImage.*` namespace (8 locales).
 */
import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import { useRegisterModal } from '../../../context/ModalContext'
import { formatBytes } from './paste-image'

/**
 * Subset of the paste-image preview the dialog actually renders. Mirrors the
 * fields on `PastedImagePreview` minus the underlying `File` so the dialog
 * stays decoupled from the FileReader path.
 */
export interface PasteImagePreviewDialogImage {
  /** Data URL rendered as the preview `<img src>`. */
  dataUrl: string
  /** Filename shown above the dimensions row. */
  name: string
  /** Intrinsic width in pixels — 0 hides the dimensions row. */
  width: number
  /** Intrinsic height in pixels — 0 hides the dimensions row. */
  height: number
  /** Raw byte size used in the formatted dimensions row. */
  sizeBytes: number
}

export interface PasteImagePreviewDialogProps {
  /** Controls dialog visibility — driven by the host composer state. */
  open: boolean
  /** Preview to render. `null` keeps the dialog closed even when `open=true`. */
  image: PasteImagePreviewDialogImage | null
  /** Open-state change handler (Radix close-on-escape / overlay click). */
  onOpenChange: (open: boolean) => void
  /** Confirm handler — caller forwards the image into the attachment path. */
  onConfirm: () => void
  /** Cancel handler — caller drops the pending paste. */
  onCancel: () => void
}

export function PasteImagePreviewDialog({
  open,
  image,
  onOpenChange,
  onConfirm,
  onCancel,
}: PasteImagePreviewDialogProps) {
  const { t } = useTranslation()

  // Register with the ModalContext so the shell knows a modal is open
  // (matches PromptRewriteDialog's pattern).
  useRegisterModal(open && image != null, () => {
    onOpenChange(false)
    onCancel()
  })

  // Guarded close handler: Radix calls onOpenChange(false) on overlay click /
  // escape; we treat that as a cancel so the host can clear the pending image.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      onOpenChange(next)
      if (!next) onCancel()
    },
    [onOpenChange, onCancel],
  )

  const hasDimensions = image != null && image.width > 0 && image.height > 0

  return (
    <Dialog open={open && image != null} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg"
        data-testid="composer-paste-image-preview-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('workbench.composer.pasteImage.title')}</DialogTitle>
        </DialogHeader>

        {image != null ? (
          <div className="space-y-3">
            <div
              className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-2"
              data-testid="composer-paste-image-preview-thumbnail"
            >
              <img
                src={image.dataUrl}
                alt={image.name}
                className="max-h-64 max-w-full object-contain"
              />
            </div>
            <div className="text-sm">
              <div
                className="truncate font-medium"
                data-testid="composer-paste-image-preview-name"
                title={image.name}
              >
                {image.name}
              </div>
              {hasDimensions ? (
                <div
                  className="text-muted-foreground"
                  data-testid="composer-paste-image-preview-dimensions"
                >
                  {t('workbench.composer.pasteImage.dimensions', {
                    width: image.width,
                    height: image.height,
                    size: formatBytes(image.sizeBytes),
                  })}
                </div>
              ) : (
                <div
                  className="text-muted-foreground"
                  data-testid="composer-paste-image-preview-size"
                >
                  {formatBytes(image.sizeBytes)}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false)
              onCancel()
            }}
            data-testid="composer-paste-image-preview-cancel"
          >
            {t('workbench.composer.pasteImage.cancel')}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onConfirm()
            }}
            data-testid="composer-paste-image-preview-confirm"
            disabled={image == null}
          >
            {t('workbench.composer.pasteImage.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
