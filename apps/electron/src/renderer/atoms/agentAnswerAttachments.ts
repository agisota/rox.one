/**
 * Atom family for AAP-driven design-artifact attachments keyed by turnId.
 *
 * Only `kind: 'design'` payloads are stored here — text/code go through
 * the normal chat stream and never touch this atom.
 *
 * Shape mirrors DesignArtifactCardProps so the renderer can pass props
 * directly without any translation layer.
 */
import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import type { DesignArtifact, OpenDesignRequest } from '@rox-one/design-contract'

export interface DesignArtifactAttachment {
  kind: 'design-artifact'
  artifact: DesignArtifact & { kind: 'design-artifact' }
  openRequest: OpenDesignRequest
}

/**
 * Atom family: turnId → DesignArtifactAttachment | null
 *
 * Null means no AAP design attachment has arrived for that turn yet.
 */
export const designAttachmentAtomFamily = atomFamily(
  (_turnId: string) => atom<DesignArtifactAttachment | null>(null),
  (a, b) => a === b,
)

/**
 * Write-only action atom: upsert a design attachment for a given turnId.
 */
export const upsertDesignAttachmentAtom = atom(
  null,
  (_get, set, payload: { turnId: string; attachment: DesignArtifactAttachment }) => {
    set(designAttachmentAtomFamily(payload.turnId), payload.attachment)
  },
)
