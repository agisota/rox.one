/**
 * useAgentAnswerStream
 *
 * Subscribes to the IPC `agent-answer:received` channel (emitted by the
 * step-3 main-process router) and dispatches incoming AgentAnswerPackage
 * payloads into Jotai state.
 *
 * - kind='design'  → upserts a DesignArtifactAttachment for the turnId
 * - kind='text'|'code' → ignored (already in the main chat stream)
 * - kind='mixed'   → recurses parts, only design parts are stored
 *
 * PZD-18 step 4.
 */
import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import type { AgentAnswerPackage } from '@rox-one/agent-contract'
import { upsertDesignAttachmentAtom } from '@/atoms/agentAnswerAttachments'
import type { DesignArtifactAttachment } from '@/atoms/agentAnswerAttachments'
import type { DesignArtifact } from '@rox-one/design-contract'

type Payload = AgentAnswerPackage['payload']

/**
 * Extract all design payloads from a (potentially mixed) AAP payload.
 * Returns an array because a `mixed` package may contain multiple design parts.
 */
function extractDesignPayloads(payload: Payload): Array<{ kind: 'design' } & Extract<Payload, { kind: 'design' }>> {
  if (payload.kind === 'design') {
    return [payload as Extract<Payload, { kind: 'design' }>]
  }
  if (payload.kind === 'mixed') {
    return payload.parts.flatMap(part => extractDesignPayloads(part as Payload))
  }
  return []
}

export function useAgentAnswerStream(): void {
  const upsertAttachment = useSetAtom(upsertDesignAttachmentAtom)

  useEffect(() => {
    const api = (window as typeof window & { electronAPI?: { onAgentAnswerReceived?: (cb: (pkg: AgentAnswerPackage) => void) => () => void } }).electronAPI
    const subscribe = api?.onAgentAnswerReceived
    if (!subscribe) return

    const unsubscribe = subscribe((pkg: AgentAnswerPackage) => {
      const designPayloads = extractDesignPayloads(pkg.payload)
      for (const dp of designPayloads) {
        // The OpenDesignRequest's artifact field isn't on the payload directly —
        // the request carries the task/context. We reconstruct a minimal
        // DesignArtifact from the request for card display.
        // NOTE: The actual DesignArtifact is stored server-side; the renderer
        // only needs the OpenDesignRequest to render the card and open the panel.
        // For now we synthesize a card-ready artifact from the request fields.
        const artifact: DesignArtifact & { kind: 'design-artifact' } = {
          id: dp.request.task.id,
          taskId: dp.request.task.id,
          type: 'html', // default; updated when artifact storage emits
          uri: `rox-storage://${dp.request.task.id}`,
          bytes: 0,
          sha256: '0'.repeat(64),
          createdAt: dp.request.task.createdAt,
          kind: 'design-artifact',
        }

        const attachment: DesignArtifactAttachment = {
          kind: 'design-artifact',
          artifact,
          openRequest: dp.request,
        }
        upsertAttachment({ turnId: pkg.turnId, attachment })
      }
    })

    return unsubscribe
  }, [upsertAttachment])
}
