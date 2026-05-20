/**
 * RTL tests for AgentAnswerAttachment — PZD-18 step 4.
 *
 * Cycles:
 *   1/2  RED→GREEN: renders DesignArtifactCard when attachment.kind='design-artifact'
 *   3/4  RED→GREEN: renders nothing for kind='text'/'code' (no attachment in atom)
 *   11/12 RED→GREEN: axe-core — 0 violations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as React from 'react'
import { expectNoA11yViolations } from '../../../../test-utils/a11y'
import { randomUUID } from 'crypto'
import { createStore, Provider } from 'jotai'
import { designAttachmentAtomFamily } from '@/atoms/agentAnswerAttachments'
import type { DesignArtifactAttachment } from '@/atoms/agentAnswerAttachments'
import { AgentAnswerAttachment } from '../AgentAnswerAttachment'
import type { DesignArtifact, OpenDesignRequest } from '@rox-one/design-contract'

// ── window.electronAPI stub ──────────────────────────────────────────────────
beforeEach(() => {
  Object.assign(window, {
    electronAPI: {
      openWithContext: vi.fn().mockResolvedValue({ status: 'opened', windowId: 1 }),
      openUrl: vi.fn(),
    },
  })
})

afterEach(() => {
  cleanup()
})

// ── Fixtures ──────────────────────────────────────────────────────────────────
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

function makeAttachment(): DesignArtifactAttachment {
  return {
    kind: 'design-artifact',
    artifact: makeArtifact(),
    openRequest: makeOpenRequest(),
  }
}

function renderWithStore(
  turnId: string,
  attachment: DesignArtifactAttachment | null = null,
) {
  const store = createStore()
  if (attachment) {
    store.set(designAttachmentAtomFamily(turnId), attachment)
  }
  return render(
    <Provider store={store}>
      <AgentAnswerAttachment turnId={turnId} />
    </Provider>,
  )
}

// ── Cycle 1/2: renders DesignArtifactCard when kind='design-artifact' ────────
describe('AgentAnswerAttachment · design-artifact kind', () => {
  it('renders the DesignArtifactCard wrapper when attachment is present', () => {
    const turnId = randomUUID()
    renderWithStore(turnId, makeAttachment())
    expect(screen.getByTestId('agent-answer-attachment')).toBeTruthy()
  })

  it('renders the inner DesignArtifactCard', () => {
    const turnId = randomUUID()
    renderWithStore(turnId, makeAttachment())
    expect(screen.getByTestId('design-artifact-card')).toBeTruthy()
  })

  it('passes openRequest so "Open in Design" button is visible', () => {
    const turnId = randomUUID()
    renderWithStore(turnId, makeAttachment())
    expect(screen.getByTestId('design-artifact-open-btn')).toBeTruthy()
  })
})

// ── Cycle 3/4: renders nothing when no attachment ─────────────────────────────
describe('AgentAnswerAttachment · no attachment (text/code)', () => {
  it('renders nothing when atom has no attachment for the turnId', () => {
    const turnId = randomUUID()
    const { container } = renderWithStore(turnId, null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a different turnId than what is stored', () => {
    const storedTurnId = randomUUID()
    const otherTurnId = randomUUID()
    const store = createStore()
    store.set(designAttachmentAtomFamily(storedTurnId), makeAttachment())
    const { container } = render(
      <Provider store={store}>
        <AgentAnswerAttachment turnId={otherTurnId} />
      </Provider>,
    )
    expect(container.firstChild).toBeNull()
  })
})

// ── Cycle 11/12: axe-core — 0 violations ─────────────────────────────────────
describe('AgentAnswerAttachment · accessibility', () => {
  it('has 0 axe violations when rendering a design attachment', async () => {
    const turnId = randomUUID()
    const { container } = renderWithStore(turnId, makeAttachment())
    await expectNoA11yViolations(container)
  })

  it('has 0 axe violations when rendering nothing (no attachment)', async () => {
    const turnId = randomUUID()
    const { container } = renderWithStore(turnId, null)
    await expectNoA11yViolations(container)
  })
})
