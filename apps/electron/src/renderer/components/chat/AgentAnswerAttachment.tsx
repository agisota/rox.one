/**
 * AgentAnswerAttachment — renders the correct viewer for an AAP attachment.
 *
 * Dispatch:
 *   - kind='design-artifact' → DesignArtifactCard (legacy path, unchanged)
 *   - kind='viewer-artifact' → ArtifactViewer (registry-based, Wave 11)
 *
 * Renders nothing for kind='text'|'code' — those are already in the main
 * message body via the normal chat stream.
 *
 * PZD-18 step 4 / PZD-37 Wave 11.
 */
import * as React from 'react'
import { useAtomValue } from 'jotai'
import { designAttachmentAtomFamily } from '@/atoms/agentAnswerAttachments'
import { DesignArtifactCard } from './DesignArtifactCard'
import { ArtifactViewer } from './ArtifactViewer'

export interface AgentAnswerAttachmentProps {
  /** The turnId of the assistant turn this attachment belongs to. */
  turnId: string
}

export function AgentAnswerAttachment({ turnId }: AgentAnswerAttachmentProps) {
  const attachment = useAtomValue(designAttachmentAtomFamily(turnId))

  if (!attachment) return null

  if (attachment.kind === 'design-artifact') {
    return (
      <div data-testid="agent-answer-attachment" className="mt-2">
        <DesignArtifactCard
          artifact={attachment.artifact}
          openRequest={attachment.openRequest}
        />
      </div>
    )
  }

  // kind === 'viewer-artifact': delegate to registry-based ArtifactViewer
  return (
    <div data-testid="agent-answer-attachment" className="mt-2">
      <ArtifactViewer artifact={{ mime: attachment.mime, uri: attachment.uri }} />
    </div>
  )
}
