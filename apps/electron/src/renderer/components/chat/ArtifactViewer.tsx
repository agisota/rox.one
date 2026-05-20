/**
 * ArtifactViewer — resolves an attachment's MIME type to a registered adapter
 * and renders its output inside a sandboxed container.
 *
 * Falls back to a plain "no viewer" card when no adapter matches.
 *
 * PZD-37 Wave 11.
 */
import * as React from 'react'
import type { ArtifactAdapter, ViewOpts } from '@rox-one/artifact-viewer-core'
import { getArtifactViewerRegistry } from '../../artifact-viewers/registry-bootstrap'
import { cn } from '@/lib/utils'

export interface ArtifactAttachment {
  /** Full MIME type of the artifact, e.g. "text/markdown". */
  mime: string
  /** URI pointing to the artifact content (file:// or data:). */
  uri: string
}

export interface ArtifactViewerProps {
  artifact: ArtifactAttachment
  className?: string
}

function buildViewOpts(): ViewOpts {
  return {
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    size: { width: 0, height: 0 },
    signal: new AbortController().signal,
    partition: 'persist:artifact-viewer',
    locale: navigator.language ?? 'en',
  }
}

type State =
  | { status: 'resolving' }
  | { status: 'resolved'; adapter: ArtifactAdapter }
  | { status: 'fallback' }

export function ArtifactViewer({ artifact, className }: ArtifactViewerProps) {
  const [state, setState] = React.useState<State>({ status: 'resolving' })

  React.useEffect(() => {
    let cancelled = false
    const registry = getArtifactViewerRegistry()
    registry.resolveByMime(artifact.mime).then((adapter) => {
      if (cancelled) return
      if (adapter) {
        setState({ status: 'resolved', adapter })
      } else {
        setState({ status: 'fallback' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [artifact.mime])

  if (state.status === 'resolving') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-muted p-4 text-xs text-muted-foreground',
          className,
        )}
        aria-busy="true"
        aria-label="Loading artifact viewer"
      />
    )
  }

  if (state.status === 'fallback') {
    return (
      <div
        className={cn(
          'flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground',
          className,
        )}
        data-testid="artifact-viewer-fallback"
        role="status"
      >
        <span className="font-semibold text-foreground">No viewer available</span>
        <span>{artifact.mime}</span>
      </div>
    )
  }

  const { adapter } = state
  const node = adapter.render(artifact.uri, buildViewOpts())

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-[--rox-bg,hsl(var(--card))] text-[--rox-fg,hsl(var(--card-foreground))]',
        className,
      )}
      data-testid="artifact-viewer-sandbox"
      data-artifact-mime={artifact.mime}
      data-adapter-kind={adapter.kind}
    >
      {node}
    </div>
  )
}
