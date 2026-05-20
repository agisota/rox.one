/**
 * AgentAnswerAttachment — renders a DesignArtifactCard when the message's
 * turn has received an AAP with kind='design'.
 *
 * Renders nothing for kind='text'|'code' — those are already in the main
 * message body via the normal chat stream.
 *
 * PZD-18 step 4.
 */
import * as React from 'react'
import { useAtomValue } from 'jotai'
import { designAttachmentAtomFamily } from '@/atoms/agentAnswerAttachments'
import { DesignArtifactCard } from './DesignArtifactCard'

export interface AgentAnswerAttachmentProps {
  /** The turnId of the assistant turn this attachment belongs to. */
  turnId: string
}

export function AgentAnswerAttachment({ turnId }: AgentAnswerAttachmentProps) {
  const attachment = useAtomValue(designAttachmentAtomFamily(turnId))

  if (!attachment || attachment.kind !== 'design-artifact') return null

  return (
    <div data-testid="agent-answer-attachment" className="mt-2">
      <DesignArtifactCard
        artifact={attachment.artifact}
        openRequest={attachment.openRequest}
      />
    </div>
  )
}
