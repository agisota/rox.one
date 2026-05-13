import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RevokeButton, performRevoke } from '../RevokeButton'
import type { RoleGrant } from '@rox-one/shared/auth'

const grant: RoleGrant = {
  roleId: 'editor',
  actorKind: 'user',
  actorId: 'user-1',
  scopeKind: 'workspace',
  scopeId: 'ws-alpha',
}

describe('RevokeButton', () => {
  test('renders a revoke button labelled with the role and scope', () => {
    const markup = renderToStaticMarkup(
      <RevokeButton grant={grant} onRevoke={() => undefined} />,
    )
    expect(markup).toContain('data-rbac-action="revoke"')
    expect(markup).toContain('Revoke')
  })

  test('performRevoke calls confirm-then-invoke against roles.revoke and fires refresh', async () => {
    const invocations: Array<{ channel: string; args: unknown[] }> = []
    let refreshed = false
    const result = await performRevoke({
      grant,
      rpcClient: {
        invoke: (channel: string, ...args: unknown[]) => {
          invocations.push({ channel, args })
          return Promise.resolve({ ok: true, revoked: true })
        },
      },
      confirm: () => true,
      onRefresh: () => {
        refreshed = true
      },
    })
    expect(invocations).toEqual([
      { channel: 'roles.revoke', args: [grant] },
    ])
    expect(result).toEqual({ ok: true, revoked: true })
    expect(refreshed).toBe(true)
  })

  test('performRevoke short-circuits when confirm returns false', async () => {
    const invocations: Array<{ channel: string; args: unknown[] }> = []
    let refreshed = false
    const result = await performRevoke({
      grant,
      rpcClient: {
        invoke: (channel: string, ...args: unknown[]) => {
          invocations.push({ channel, args })
          return Promise.resolve({ ok: true, revoked: true })
        },
      },
      confirm: () => false,
      onRefresh: () => {
        refreshed = true
      },
    })
    expect(invocations).toEqual([])
    expect(result).toBeNull()
    expect(refreshed).toBe(false)
  })

  test('performRevoke surfaces error result without firing refresh', async () => {
    let refreshed = false
    const result = await performRevoke({
      grant,
      rpcClient: {
        invoke: () => Promise.resolve({ error: 'permission-denied', reason: 'no-owner-grant' }),
      },
      confirm: () => true,
      onRefresh: () => {
        refreshed = true
      },
    })
    expect(result).toEqual({ error: 'permission-denied', reason: 'no-owner-grant' })
    expect(refreshed).toBe(false)
  })
})
