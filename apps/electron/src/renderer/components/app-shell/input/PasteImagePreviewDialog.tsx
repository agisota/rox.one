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
import { Switch } from '../../ui/switch'
import { useRegisterModal } from '../../../context/ModalContext'
import { formatBytes } from './paste-image'
import {
  DEFAULT_BUDGET,
  computeTargetDimensions,
  shouldResize,
  type ResizeBudget,
} from './image-resize'

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
  /**
   * Confirm handler — caller forwards the image into the attachment path.
   * Receives the user's resize-toggle preference so the host can run the
   * resize step before handing the image to `readFileAsAttachment` (T237b).
   * Hosts on the legacy contract may ignore the argument.
   */
  onConfirm: (opts?: { resize: boolean }) => void
  /** Cancel handler — caller drops the pending paste. */
  onCancel: () => void
  /**
   * Optional resize budget override. Defaults to 2 MB / 2048px longest edge.
   * Exposed for tests and a future "resize threshold" settings surface.
   */
  resizeBudget?: ResizeBudget
}

export function PasteImagePreviewDialog({
  open,
  image,
  onOpenChange,
  onConfirm,
  onCancel,
  resizeBudget = DEFAULT_BUDGET,
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
  // The resize toggle is only surfaced when the image trips the byte / pixel
  // budget. Default ON so the recommendation is opt-out, not opt-in.
  const overBudget = shouldResize(image, resizeBudget)
  const [resizeOn, setResizeOn] = React.useState(true)
  // Re-arm the toggle whenever a new image enters the dialog so a previous
  // user's opt-out doesn't carry across sessions.
  const dataUrlKey = image?.dataUrl ?? ''
  React.useEffect(() => {
    setResizeOn(true)
  }, [dataUrlKey])

  // Preview the post-resize dimensions for the recommendation row so the user
  // can see exactly what they're about to attach.
  const resizeTarget = React.useMemo(() => {
    if (!overBudget || image == null) return null
    return computeTargetDimensions(image.width, image.height, resizeBudget.maxLongestEdgePx)
  }, [overBudget, image, resizeBudget.maxLongestEdgePx])

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
            {overBudget ? (
              <div
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
                data-testid="composer-paste-image-preview-resize-row"
              >
                <label
                  htmlFor="composer-paste-image-preview-resize-toggle"
                  className="flex flex-col"
                >
                  <span className="font-medium">
                    {t('workbench.composer.pasteImage.resizeToggle')}
                  </span>
                  {resizeTarget != null && resizeTarget.width > 0 ? (
                    <span
                      className="text-muted-foreground text-xs"
                      data-testid="composer-paste-image-preview-resize-hint"
                    >
                      {t('workbench.composer.pasteImage.resizeHint', {
                        width: resizeTarget.width,
                        height: resizeTarget.height,
                      })}
                    </span>
                  ) : null}
                </label>
                <Switch
                  id="composer-paste-image-preview-resize-toggle"
                  checked={resizeOn}
                  onCheckedChange={setResizeOn}
                  aria-label={t('workbench.composer.pasteImage.resizeToggle')}
                  data-testid="composer-paste-image-preview-resize-switch"
                />
              </div>
            ) : null}
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
              // Forward the toggle state. When the image is under budget the
              // toggle isn't shown and `resize` is `false` by definition so the
              // host short-circuits the resize pass.
              onConfirm({ resize: overBudget && resizeOn })
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
