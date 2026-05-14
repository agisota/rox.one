import { unlink } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import { getCredentialManager } from '@rox-one/shared/credentials'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { requestClientConfirmDialog } from '@rox-one/server-core/transport'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.auth.LOGOUT,
  RPC_CHANNELS.auth.SHOW_LOGOUT_CONFIRMATION,
  RPC_CHANNELS.auth.SHOW_DELETE_SESSION_CONFIRMATION,
  RPC_CHANNELS.credentials.HEALTH_CHECK,
] as const

export function registerAuthHandlers(server: RpcServer, deps: HandlerDeps): void {
  // Show logout confirmation dialog (routed to client)
  server.handle(RPC_CHANNELS.auth.SHOW_LOGOUT_CONFIRMATION, async (ctx) => {
    const result = await requestClientConfirmDialog(server, ctx.clientId, {
      type: 'warning',
      buttons: ['Cancel', 'Log Out'],
      defaultId: 0,
      cancelId: 0,
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      detail: 'All conversations will be deleted. This action cannot be undone.',
    })
    // result.response is the index of the clicked button
    // 0 = Cancel, 1 = Log Out
    return result.response === 1
  })

  // Show delete session confirmation dialog (routed to client)
  server.handle(RPC_CHANNELS.auth.SHOW_DELETE_SESSION_CONFIRMATION, async (ctx, name: string) => {
    const result = await requestClientConfirmDialog(server, ctx.clientId, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Delete Conversation',
      message: `Are you sure you want to delete: "${name}"?`,
      detail: 'This action cannot be undone.',
    })
    // result.response is the index of the clicked button
    // 0 = Cancel, 1 = Delete
    return result.response === 1
  })

  // Logout - clear all credentials and config
  server.handle(RPC_CHANNELS.auth.LOGOUT, async (ctx) => {
    // T086d: optional rate-limit. Sits BEFORE the credential store
    // mutation so a burst of logout calls cannot hammer the keychain.
    // Absent => no-op.
    if (deps.rateLimiter && !deps.rateLimiter.tryAcquire(1)) {
      return { error: 'rate-limited', reason: 'token-bucket-exhausted' }
    }

    // T086d: optional per-actor budget guard. Runs AFTER the bucket gate
    // and BEFORE the credential mutation. Absent => no-op.
    if (deps.budgetGuard) {
      const key = ctx.userId ?? '__anonymous__'
      const result = deps.budgetGuard.consume(key, 1)
      if (!result.ok) {
        return { error: 'budget-exceeded', reason: 'per-actor-cap-exhausted' }
      }
    }

    try {
      const manager = getCredentialManager()

      // List and delete all stored credentials
      const allCredentials = await manager.list()
      for (const credId of allCredentials) {
        await manager.delete(credId)
      }

      // Delete the config file
      const configPath = join(homedir(), '.rox', 'config.json')
      await unlink(configPath).catch(() => {
        // Ignore if file doesn't exist
      })

      deps.platform.logger.info('Logout complete - cleared all credentials and config')
    } catch (error) {
      deps.platform.logger.error('Logout error:', error)
      throw error
    }
  })

  // Credential health check - validates credential store is readable and usable
  // Called on app startup to detect corruption, machine migration, or missing credentials
  server.handle(RPC_CHANNELS.credentials.HEALTH_CHECK, async () => {
    const manager = getCredentialManager()
    return manager.checkHealth()
  })
}
