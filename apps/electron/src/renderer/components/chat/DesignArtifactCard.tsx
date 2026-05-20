/**
 * DesignArtifactCard — chat attachment card for design artifacts (T537 Phase B).
 *
 * Renders:
 *   - Thumbnail preview (if thumbnailUri is present)
 *   - Artifact type badge + file size
 *   - Download link (opens the file:// URI via electronAPI.openUrl)
 *   - "Open in Design" action button (calls openWithContext)
 */
import * as React from 'react'
import type { DesignArtifact, OpenDesignRequest } from '@rox-one/design-contract'
import { cn } from '@/lib/utils'

export interface DesignArtifactCardProps {
  artifact: DesignArtifact & { kind: 'design-artifact' }
  /** OpenDesignRequest to dispatch when user clicks "Open in Design". */
  openRequest?: OpenDesignRequest
  className?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DesignArtifactCard({ artifact, openRequest, className }: DesignArtifactCardProps) {
  const [status, setStatus] = React.useState<'idle' | 'opening' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const handleDownload = React.useCallback(() => {
    // Open file via shell — electronAPI.openUrl handles file:// URIs
    window.electronAPI.openUrl?.(artifact.uri)
  }, [artifact.uri])

  const handleOpenInDesign = React.useCallback(async () => {
    if (!openRequest) return
    setStatus('opening')
    setErrorMsg(null)
    try {
      const result = await window.electronAPI.openWithContext(openRequest)
      if (result.status === 'failed') {
        setStatus('error')
        setErrorMsg(result.reason)
      } else {
        setStatus('idle')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }, [openRequest])

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-sm',
        className,
      )}
      data-testid="design-artifact-card"
      data-artifact-kind="design-artifact"
    >
      {/* Thumbnail */}
      {artifact.thumbnailUri && (
        <div className="overflow-hidden rounded-md bg-muted">
          <img
            src={artifact.thumbnailUri}
            alt={`Thumbnail for ${artifact.type} artifact`}
            className="h-32 w-full object-cover"
            data-testid="design-artifact-thumbnail"
          />
        </div>
      )}

      {/* Info row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono font-semibold uppercase tracking-wide text-muted-foreground"
            data-testid="design-artifact-type"
          >
            {artifact.type}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {formatBytes(artifact.bytes)}
          </span>
        </div>

        {/* Download link */}
        <button
          type="button"
          onClick={handleDownload}
          className="text-xs text-primary underline-offset-2 hover:underline"
          data-testid="design-artifact-download"
          aria-label="Download artifact"
        >
          Download
        </button>
      </div>

      {/* Open in Design button */}
      {openRequest && (
        <button
          type="button"
          onClick={handleOpenInDesign}
          disabled={status === 'opening'}
          className="mt-1 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="design-artifact-open-btn"
        >
          {status === 'opening' ? 'Opening…' : 'Open in Design'}
        </button>
      )}

      {/* Error state */}
      {status === 'error' && errorMsg && (
        <p className="text-xs text-destructive" data-testid="design-artifact-error">
          {errorMsg}
        </p>
      )}
    </div>
  )
}
