import * as React from 'react'
import { Code2, Copy, Download, Eye, Maximize2, X } from 'lucide-react'
import type { AgentArtifact } from '@rox-one/shared/protocol'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { buildArtifactSandboxSrcDoc, getArtifactIframeSandbox } from './artifact-sandbox'

export type ArtifactPanelMode = 'preview' | 'code'

interface ArtifactPanelProps {
  artifact: AgentArtifact | null
  artifacts: AgentArtifact[]
  mode: ArtifactPanelMode
  width: number
  isCompact: boolean
  onModeChange: (mode: ArtifactPanelMode) => void
  onClose: () => void
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void
  onSelectArtifact: (artifactId: string) => void
}

function getArtifactFilename(artifact: AgentArtifact): string {
  const extension = artifact.type === 'markdown'
    ? 'md'
    : artifact.type === 'html'
      ? 'html'
      : artifact.type === 'json'
        ? 'json'
        : 'txt'
  const safeTitle = artifact.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || artifact.id
  return `${safeTitle}.${extension}`
}

function renderPreview(artifact: AgentArtifact) {
  if (artifact.type === 'html') {
    return (
      <iframe
        title={artifact.title}
        className="h-full w-full bg-background"
        sandbox={getArtifactIframeSandbox({ interactive: true })}
        srcDoc={buildArtifactSandboxSrcDoc(artifact.content, {
          interactive: true,
          title: artifact.title,
        })}
      />
    )
  }

  const language = artifact.type === 'markdown' ? 'markdown' : artifact.type
  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-4 text-[13px] leading-6 text-foreground">
      <code data-language={language}>{artifact.content}</code>
    </pre>
  )
}

export function ArtifactPanel({
  artifact,
  artifacts,
  mode,
  width,
  isCompact,
  onModeChange,
  onClose,
  onResizeStart,
  onSelectArtifact,
}: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const handleCopy = React.useCallback(() => {
    if (!artifact) return
    void navigator.clipboard?.writeText(artifact.content)
  }, [artifact])

  const handleDownload = React.useCallback(() => {
    if (!artifact || typeof document === 'undefined') return
    const blob = new Blob([artifact.content], { type: artifact.type === 'html' ? 'text/html' : 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getArtifactFilename(artifact)
    link.click()
    URL.revokeObjectURL(url)
  }, [artifact])

  const content = artifact ? (
    mode === 'preview'
      ? renderPreview(artifact)
      : (
        <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-4 text-[13px] leading-6 text-foreground">
          <code>{artifact.content}</code>
        </pre>
      )
  ) : (
    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
      No artifact selected
    </div>
  )

  const panel = (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col overflow-hidden border border-border/70 bg-background shadow-middle',
        isCompact ? 'absolute inset-0 z-overlay rounded-none' : 'rounded-[8px]',
      )}
      style={{ width: isCompact ? '100%' : width }}
      data-testid="artifact-panel"
    >
      {!isCompact && (
        <div
          className="absolute inset-y-0 left-0 z-10 w-2 -translate-x-1 cursor-col-resize"
          onMouseDown={onResizeStart}
          aria-hidden="true"
        />
      )}

      <header className="flex min-h-12 items-center gap-2 overflow-x-auto border-b border-border/60 px-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-foreground">
            {artifact?.title ?? 'Artifact'}
          </div>
          {artifacts.length > 1 && (
            <select
              className="mt-0.5 max-w-full bg-transparent text-[11px] text-muted-foreground outline-none"
              value={artifact?.id ?? ''}
              onChange={(event) => onSelectArtifact(event.target.value)}
            >
              {artifacts.map(item => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-md bg-muted/40 p-0.5">
          <Button
            type="button"
            variant={mode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => onModeChange('preview')}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            type="button"
            variant={mode === 'code' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => onModeChange('code')}
          >
            <Code2 className="h-3.5 w-3.5" />
            Code
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy} disabled={!artifact}>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleDownload} disabled={!artifact}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setIsFullscreen(true)} disabled={!artifact}>
            <Maximize2 className="h-3.5 w-3.5" />
            Fullscreen
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Close
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 bg-background">
        {content}
      </div>
    </aside>
  )

  return (
    <>
      {panel}
      {isFullscreen && (
        <div className="fixed inset-0 z-modal flex flex-col bg-background">
          <div className="flex h-12 items-center justify-between border-b border-border/60 px-4">
            <div className="truncate text-sm font-medium">{artifact?.title}</div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsFullscreen(false)}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
