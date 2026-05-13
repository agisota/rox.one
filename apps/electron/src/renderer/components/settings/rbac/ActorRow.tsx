/**
 * ActorRow — single-actor row for the T231 team management view.
 *
 * Renders the actor's display name, an actor-kind badge (user/team),
 * and a chip list of (role × scope) grants. Each chip is clickable
 * and triggers the parent's revoke handler after a `confirm()` gate.
 *
 * The chip render path is intentionally a `<button>` so keyboard users
 * can tab through grants and hit Enter to revoke — matches the
 * WCAG 2.2 AA rule we apply to every other settings affordance.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { RoleGrant } from '@rox-one/shared/auth'
import type { ActorRowView } from './team-management-state'

export interface ActorRowProps {
  row: ActorRowView
  /**
   * Called when the admin clicks a chip and confirms revocation.
   * The host is responsible for the RPC + dispatch (`grant-revoked`).
   */
  onRevoke: (grant: RoleGrant) => void | Promise<void>
  /**
   * Disables the revoke affordance — wired by the panel when the
   * caller is not an owner. Chips remain visible but read-only.
   */
  readOnly?: boolean
  /**
   * Optional confirmation prompt (defaults to `window.confirm`). The
   * panel passes this through from props so tests can short-circuit
   * the modal.
   */
  confirm?: (grant: RoleGrant) => boolean
}

function defaultConfirm(grant: RoleGrant): boolean {
  if (typeof window === 'undefined') return false
  return window.confirm(`Revoke ${grant.roleId} from ${grant.actorId}?`)
}

function formatScope(
  scopeKind: RoleGrant['scopeKind'],
  scopeId: RoleGrant['scopeId'],
): string {
  if (scopeKind === 'global') return 'global'
  if (!scopeId) return scopeKind
  return `${scopeKind}:${scopeId}`
}

export function ActorRow({
  row,
  onRevoke,
  readOnly = false,
  confirm = defaultConfirm,
}: ActorRowProps): React.ReactElement {
  const handleChipClick = (grant: RoleGrant) => {
    if (readOnly) return
    if (!confirm(grant)) return
    void onRevoke(grant)
  }

  return (
    <div
      data-rbac-actor-row
      data-actor-kind={row.actorKind}
      data-actor-id={row.actorId}
      className="flex flex-col gap-2 px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {row.displayName}
        </span>
        <Badge variant="outline" className="text-[10px] uppercase">
          {row.actorKind}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {row.grants.length} grant{row.grants.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {row.grants.length === 0 ? (
          <span className="text-xs text-muted-foreground">No grants</span>
        ) : (
          row.grants.map((entry) => (
            <Button
              key={entry.key}
              type="button"
              data-rbac-grant-chip
              data-role-id={entry.roleId}
              data-scope-kind={entry.scopeKind}
              data-scope-id={entry.scopeId ?? ''}
              size="sm"
              variant="secondary"
              disabled={readOnly}
              onClick={() => handleChipClick(entry.grant)}
              className="h-7 rounded-full px-3 text-xs"
              title={readOnly ? 'Read-only — owner required to revoke' : `Click to revoke ${entry.roleName}`}
            >
              <span className="font-medium">{entry.roleName}</span>
              <span className="ml-1.5 text-muted-foreground">
                {formatScope(entry.scopeKind, entry.scopeId)}
              </span>
            </Button>
          ))
        )}
      </div>
    </div>
  )
}
