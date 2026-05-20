/**
 * RTL tests for DesignArtifactCard — T537 Phase B.
 * Runs under vitest + happy-dom via `bun run test:rtl`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as React from 'react'
import { randomUUID } from 'crypto'
import { DesignArtifactCard } from '../DesignArtifactCard'
import type { DesignArtifact, OpenDesignRequest } from '@rox-one/design-contract'

// ── window.electronAPI stub ──────────────────────────────────────────────────
const mockOpenWithContext = vi.fn()
const mockOpenUrl = vi.fn()

beforeEach(() => {
  mockOpenWithContext.mockReset()
  mockOpenUrl.mockReset()
  Object.assign(window, {
    electronAPI: {
      openWithContext: mockOpenWithContext,
      openUrl: mockOpenUrl,
    },
  })
})

afterEach(() => {
  cleanup()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────
function makeArtifact(overrides?: Partial<DesignArtifact>): DesignArtifact & { kind: 'design-artifact' } {
  return {
    id: randomUUID(),
    taskId: randomUUID(),
    type: 'html',
    uri: 'file:///tmp/design/test.html',
    bytes: 2048,
    sha256: 'a'.repeat(64),
    createdAt: new Date().toISOString(),
    ...overrides,
    kind: 'design-artifact',
  }
}

function makeOpenRequest(): OpenDesignRequest {
  return {
    task: {
      id: randomUUID(),
      description: 'Build landing page',
      kind: 'landing',
      locale: 'en',
      createdAt: new Date().toISOString(),
    },
    context: {
      sessionId: 'sess-1',
      workspaceId: null,
      attachedFileIds: [],
      theme: 'light',
      locale: 'en',
    },
    autoLaunched: false,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('DesignArtifactCard · rendering', () => {
  it('renders when artifact.kind = design-artifact', () => {
    render(<DesignArtifactCard artifact={makeArtifact()} />)
    expect(screen.getByTestId('design-artifact-card')).toBeTruthy()
  })

  it('renders type badge', () => {
    render(<DesignArtifactCard artifact={makeArtifact({ type: 'html' })} />)
    expect(screen.getByTestId('design-artifact-type').textContent).toBe('html')
  })

  it('renders thumbnail img when thumbnailUri is present', () => {
    const artifact = makeArtifact({ thumbnailUri: 'file:///tmp/thumb.png' })
    render(<DesignArtifactCard artifact={artifact} />)
    const img = screen.getByTestId('design-artifact-thumbnail') as HTMLImageElement
    expect(img.src).toContain('file:///tmp/thumb.png')
  })

  it('does NOT render thumbnail when thumbnailUri is absent', () => {
    render(<DesignArtifactCard artifact={makeArtifact()} />)
    expect(screen.queryByTestId('design-artifact-thumbnail')).toBeNull()
  })

  it('renders download button', () => {
    render(<DesignArtifactCard artifact={makeArtifact()} />)
    expect(screen.getByTestId('design-artifact-download')).toBeTruthy()
  })

  it('renders "Open in Design" button when openRequest is provided', () => {
    render(<DesignArtifactCard artifact={makeArtifact()} openRequest={makeOpenRequest()} />)
    expect(screen.getByTestId('design-artifact-open-btn')).toBeTruthy()
  })

  it('does NOT render "Open in Design" button when openRequest is absent', () => {
    render(<DesignArtifactCard artifact={makeArtifact()} />)
    expect(screen.queryByTestId('design-artifact-open-btn')).toBeNull()
  })
})

describe('DesignArtifactCard · download action', () => {
  it('calls openUrl with artifact.uri when Download is clicked', () => {
    const artifact = makeArtifact()
    render(<DesignArtifactCard artifact={artifact} />)
    fireEvent.click(screen.getByTestId('design-artifact-download'))
    expect(mockOpenUrl).toHaveBeenCalledWith(artifact.uri)
  })
})

describe('DesignArtifactCard · Open in Design action', () => {
  it('calls openWithContext with the openRequest when button is clicked', async () => {
    mockOpenWithContext.mockResolvedValue({ status: 'opened', windowId: 1 })
    const req = makeOpenRequest()
    render(<DesignArtifactCard artifact={makeArtifact()} openRequest={req} />)
    fireEvent.click(screen.getByTestId('design-artifact-open-btn'))
    await waitFor(() => expect(mockOpenWithContext).toHaveBeenCalledWith(req))
  })

  it('shows error message when openWithContext returns status=failed', async () => {
    mockOpenWithContext.mockResolvedValue({ status: 'failed', reason: 'Something went wrong' })
    render(<DesignArtifactCard artifact={makeArtifact()} openRequest={makeOpenRequest()} />)
    fireEvent.click(screen.getByTestId('design-artifact-open-btn'))
    await waitFor(() => expect(screen.getByTestId('design-artifact-error')).toBeTruthy())
    expect(screen.getByTestId('design-artifact-error').textContent).toContain('Something went wrong')
  })

  it('shows error message when openWithContext throws', async () => {
    mockOpenWithContext.mockRejectedValue(new Error('IPC failure'))
    render(<DesignArtifactCard artifact={makeArtifact()} openRequest={makeOpenRequest()} />)
    fireEvent.click(screen.getByTestId('design-artifact-open-btn'))
    await waitFor(() => expect(screen.getByTestId('design-artifact-error')).toBeTruthy())
    expect(screen.getByTestId('design-artifact-error').textContent).toContain('IPC failure')
  })
})
