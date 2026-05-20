import * as React from 'react'
import type { AgentArtifact } from '@rox-one/shared/protocol'
import { ArtifactPanel, type ArtifactPanelMode } from './ArtifactPanel'

interface ArtifactRailProps {
  sessionId: string
  artifactId?: string
  width: number
  isCompact: boolean
  onClose: () => void
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void
}

export function ArtifactRail({
  sessionId,
  artifactId,
  width,
  isCompact,
  onClose,
  onResizeStart,
}: ArtifactRailProps) {
  const [artifacts, setArtifacts] = React.useState<AgentArtifact[]>([])
  const [selectedArtifactId, setSelectedArtifactId] = React.useState<string | undefined>(artifactId)
  const [mode, setMode] = React.useState<ArtifactPanelMode>('preview')

  const loadArtifacts = React.useCallback(async () => {
    if (!window.electronAPI?.listArtifacts) {
      setArtifacts([])
      return
    }
    try {
      const next = await window.electronAPI.listArtifacts(sessionId)
      setArtifacts(next)
      setSelectedArtifactId(current => {
        if (current && next.some(artifact => artifact.id === current)) return current
        if (artifactId && next.some(artifact => artifact.id === artifactId)) return artifactId
        return next[0]?.id
      })
    } catch {
      setArtifacts([])
      setSelectedArtifactId(undefined)
    }
  }, [artifactId, sessionId])

  React.useEffect(() => {
    setSelectedArtifactId(artifactId)
  }, [artifactId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await loadArtifacts()
    })()
    return () => {
      cancelled = true
    }
  }, [loadArtifacts])

  React.useEffect(() => {
    if (!window.electronAPI?.onArtifactsChanged) return
    return window.electronAPI.onArtifactsChanged((changedSessionId) => {
      if (changedSessionId === sessionId) {
        void loadArtifacts()
      }
    })
  }, [loadArtifacts, sessionId])

  const artifact = React.useMemo(() => {
    if (selectedArtifactId) {
      return artifacts.find(item => item.id === selectedArtifactId) ?? null
    }
    return artifacts[0] ?? null
  }, [artifacts, selectedArtifactId])

  return (
    <ArtifactPanel
      artifact={artifact}
      artifacts={artifacts}
      mode={mode}
      width={width}
      isCompact={isCompact}
      onModeChange={setMode}
      onClose={onClose}
      onResizeStart={onResizeStart}
      onSelectArtifact={setSelectedArtifactId}
    />
  )
}
