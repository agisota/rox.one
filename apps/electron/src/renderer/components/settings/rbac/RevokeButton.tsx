/**
 * RevokeButton — confirm-then-call wrapper around the T227
 * `roles.revoke` RPC. The pure `performRevoke` helper is exported for
 * tests so the confirm/refresh contract can be exercised without a
 * DOM.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import type { RolesPanelRpcClient } from './RolesPanelContext'
import type { RoleGrant } from '@rox-one/shared/auth'

export type RevokeResult =
  | { ok: true; revoked: boolean }
  | { error: string; reason?: string }
  | null

export interface PerformRevokeInput {
  grant: RoleGrant
  rpcClient: RolesPanelRpcClient
  confirm: () => boolean
  onRefresh: () => void
}

/**
 * Asks `confirm()`. On `true`, calls `roles.revoke(grant)` and fires
 * `onRefresh()` on a successful result. Returns the raw RPC response,
 * or `null` if the user cancelled the confirmation.
 */
export async function performRevoke({
  grant,
  rpcClient,
  confirm,
  onRefresh,
}: PerformRevokeInput): Promise<RevokeResult> {
  if (!confirm()) return null
  const raw = (await rpcClient.invoke('roles.revoke', grant)) as RevokeResult
  if (raw && typeof raw === 'object' && 'ok' in raw && raw.ok) {
    onRefresh()
  }
  return raw
}

export interface RevokeButtonProps {
  grant: RoleGrant
  /** Called after a successful revoke; used to refresh the parent list. */
  onRevoke: () => void
  /** Optional injected `RpcClient` (mostly for tests). Defaults to the
   *  panel context's client. */
  rpcClient?: RolesPanelRpcClient
  /** Optional confirmation prompt (defaults to `window.confirm`). */
  confirm?: () => boolean
}

export function RevokeButton({ grant, onRevoke, rpcClient, confirm }: RevokeButtonProps): React.ReactElement {
  const [pending, setPending] = React.useState(false)
  const handleClick = async () => {
    if (!rpcClient) return
    setPending(true)
    try {
      await performRevoke({
        grant,
        rpcClient,
        confirm: confirm ?? (() => typeof window !== 'undefined' && window.confirm(`Revoke ${grant.roleId} from ${grant.actorId}?`)),
        onRefresh: onRevoke,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      data-rbac-action="revoke"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
    >
      Revoke
    </Button>
  )
}
