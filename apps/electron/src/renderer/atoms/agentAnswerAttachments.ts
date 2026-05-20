/**
 * Atom family for AAP-driven artifact attachments keyed by turnId.
 *
 * Supports two discriminated-union shapes:
 *   - DesignArtifactAttachment (kind='design-artifact'): rendered by DesignArtifactCard (legacy).
 *   - ViewerArtifactAttachment (kind='viewer-artifact'): rendered by ArtifactViewer via registry.
 *
 * text/code turns go through the normal chat stream and never touch this atom.
 */
import { atom } from 'jotai'
import { atomFamily } from 'jotai-family'
import type { DesignArtifact, OpenDesignRequest } from '@rox-one/design-contract'

export interface DesignArtifactAttachment {
  kind: 'design-artifact'
  artifact: DesignArtifact & { kind: 'design-artifact' }
  openRequest: OpenDesignRequest
}

/** Generic artifact attachment routed through the ArtifactViewerRegistry. */
export interface ViewerArtifactAttachment {
  kind: 'viewer-artifact'
  /** Full MIME type, e.g. "text/markdown". */
  mime: string
  /** URI pointing to the artifact content (file:// or data:). */
  uri: string
}

export type AnyArtifactAttachment = DesignArtifactAttachment | ViewerArtifactAttachment

/**
 * Atom family: turnId → AnyArtifactAttachment | null
 *
 * Null means no AAP attachment has arrived for that turn yet.
 */
export const designAttachmentAtomFamily = atomFamily(
  (_turnId: string) => atom<AnyArtifactAttachment | null>(null),
  (a, b) => a === b,
)

/**
 * Write-only action atom: upsert an artifact attachment for a given turnId.
 */
export const upsertDesignAttachmentAtom = atom(
  null,
  (_get, set, payload: { turnId: string; attachment: AnyArtifactAttachment }) => {
    set(designAttachmentAtomFamily(payload.turnId), payload.attachment)
  },
)
