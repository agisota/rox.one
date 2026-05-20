import { describe, expect, it } from 'bun:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AgentArtifact } from '@rox-one/shared/protocol'
import { ArtifactPanel } from '../ArtifactPanel'

function artifact(overrides: Partial<AgentArtifact> = {}): AgentArtifact {
  return {
    id: 'artifact-1',
    conversationId: 'session-1',
    type: 'html',
    title: 'Demo artifact',
    content: '<h1>Demo</h1>',
    currentVersionId: 'version-1',
    createdAt: 1000,
    updatedAt: 1000,
    versions: [
      {
        id: 'version-1',
        artifactId: 'artifact-1',
        content: '<h1>Demo</h1>',
        createdAt: 1000,
      },
    ],
    ...overrides,
  }
}

describe('ArtifactPanel', () => {
  it('renders Preview and Code modes plus the required toolbar actions', () => {
    const markup = renderToStaticMarkup(
      <ArtifactPanel
        artifact={artifact()}
        artifacts={[artifact()]}
        mode="preview"
        width={420}
        isCompact={false}
        onModeChange={() => undefined}
        onClose={() => undefined}
        onResizeStart={() => undefined}
        onSelectArtifact={() => undefined}
      />,
    )

    expect(markup).toContain('Demo artifact')
    expect(markup).toContain('Preview')
    expect(markup).toContain('Code')
    expect(markup).toContain('Copy')
    expect(markup).toContain('Download')
    expect(markup).toContain('Fullscreen')
    expect(markup).toContain('Close')
    expect(markup).toContain('sandbox="allow-scripts"')
  })

  it('renders a compact empty state when no artifact is available', () => {
    const markup = renderToStaticMarkup(
      <ArtifactPanel
        artifact={null}
        artifacts={[]}
        mode="preview"
        width={420}
        isCompact={false}
        onModeChange={() => undefined}
        onClose={() => undefined}
        onResizeStart={() => undefined}
        onSelectArtifact={() => undefined}
      />,
    )

    expect(markup).toContain('No artifact selected')
  })
})
