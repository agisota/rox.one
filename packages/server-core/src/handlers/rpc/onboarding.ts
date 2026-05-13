/**
 * Onboarding IPC handlers for Electron main process
 *
 * Handles workspace setup and configuration persistence.
 */
import { getAuthState, getSetupNeeds } from '@rox-one/shared/auth'
import { getCredentialManager } from '@rox-one/shared/credentials'
import { setSetupDeferred } from '@rox-one/shared/config'
import { prepareClaudeOAuth, exchangeClaudeCode, hasValidOAuthState, clearOAuthState, prepareMcpOAuth } from '@rox-one/shared/auth'
import { validateMcpConnection } from '@rox-one/shared/mcp'
import { RPC_CHANNELS } from '@rox-one/shared/protocol'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { parseId, invalidInput } from './_validators'

/**
 * Validate a URL-like string at the boundary before it reaches any
 * network-facing API (MCP server, OAuth endpoint). Rejects:
 *   - non-strings
 *   - empty / whitespace-only
 *   - values longer than 2048 chars (well above any real URL)
 *   - javascript: / data: / vbscript: schemes (script-injection vectors)
 * Does NOT perform full URL parsing — that is left to the downstream
 * callers which already parse with `new URL()` or validateMcpConnection.
 */
function parseUrl(name: string, value: unknown): string {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  const s = value.trim()
  if (s.length === 0) invalidInput(`${name} must not be empty`)
  if (s.length > 2048) invalidInput(`${name} must be <= 2048 chars`)
  const lower = s.toLowerCase()
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    invalidInput(`${name} must not use a blocked scheme`)
  }
  return s
}

/**
 * Validate an OAuth authorization code: non-empty string, max 1024 chars,
 * no control characters. Codes are opaque server-issued tokens; we only
 * guard against injection via control bytes and oversized payloads.
 */
function parseAuthCode(name: string, value: unknown): string {
  if (typeof value !== 'string') invalidInput(`${name} must be a string`)
  if (value.length === 0) invalidInput(`${name} must not be empty`)
  if (value.length > 1024) invalidInput(`${name} must be <= 1024 chars`)
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) invalidInput(`${name} must not contain control characters`)
  }
  return value
}

// ============================================
// IPC Handlers
// ============================================

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.onboarding.GET_AUTH_STATE,
  RPC_CHANNELS.onboarding.VALIDATE_MCP,
  RPC_CHANNELS.onboarding.START_MCP_OAUTH,
  RPC_CHANNELS.onboarding.START_CLAUDE_OAUTH,
  RPC_CHANNELS.onboarding.EXCHANGE_CLAUDE_CODE,
  RPC_CHANNELS.onboarding.HAS_CLAUDE_OAUTH_STATE,
  RPC_CHANNELS.onboarding.CLEAR_CLAUDE_OAUTH_STATE,
  RPC_CHANNELS.onboarding.DEFER_SETUP,
] as const

export function registerOnboardingHandlers(server: RpcServer, deps: HandlerDeps): void {
  const log = deps.platform.logger

  // Get current auth state
  server.handle(RPC_CHANNELS.onboarding.GET_AUTH_STATE, async () => {
    const authState = await getAuthState()
    const setupNeeds = getSetupNeeds(authState)
    // Redact raw credentials — renderer only needs boolean flags (hasCredentials, setupNeeds)
    return {
      authState: {
        ...authState,
        billing: {
          ...authState.billing,
          apiKey: authState.billing.apiKey ? '••••' : null,
          claudeOAuthToken: authState.billing.claudeOAuthToken ? '••••' : null,
        },
      },
      setupNeeds,
    }
  })

  // Validate MCP connection
  server.handle(RPC_CHANNELS.onboarding.VALIDATE_MCP, async (_ctx, mcpUrl: unknown, accessToken?: unknown) => {
    try {
      const parsedUrl = parseUrl('mcpUrl', mcpUrl)
      const parsedToken = accessToken !== undefined && accessToken !== null
        ? parseAuthCode('accessToken', accessToken)
        : undefined
      const result = await validateMcpConnection({
        mcpUrl: parsedUrl,
        mcpAccessToken: parsedToken,
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Prepare MCP server OAuth (server-side only — no browser open).
  // Returns authUrl for the client to open locally.
  // NOTE: Currently unused in renderer. If re-enabled, needs client-side
  // orchestration (callback server + browser open) like performOAuth().
  server.handle(RPC_CHANNELS.onboarding.START_MCP_OAUTH, async (_ctx, mcpUrl: unknown, callbackPort?: unknown) => {
    log.info('[Onboarding:Main] ONBOARDING_START_MCP_OAUTH received')
    try {
      const parsedUrl = parseUrl('mcpUrl', mcpUrl)
      if (!callbackPort || typeof callbackPort !== 'number' || !Number.isInteger(callbackPort) || callbackPort < 1 || callbackPort > 65535) {
        throw new Error('callbackPort is required — client must run a local callback server')
      }
      const prepared = await prepareMcpOAuth(parsedUrl, { callbackPort })
      log.info('[Onboarding:Main] MCP OAuth prepared, returning authUrl to client')

      return {
        success: true,
        authUrl: prepared.authUrl,
        state: prepared.state,
        codeVerifier: prepared.codeVerifier,
        tokenEndpoint: prepared.tokenEndpoint,
        clientId: prepared.clientId,
        redirectUri: prepared.redirectUri,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.error('[Onboarding:Main] MCP OAuth prepare failed:', message)
      return { success: false, error: message }
    }
  })

  // Prepare Claude OAuth flow (server-side only — no browser open).
  // Returns authUrl for the client to open locally via shell.openExternal.
  server.handle(RPC_CHANNELS.onboarding.START_CLAUDE_OAUTH, async () => {
    try {
      log.info('[Onboarding] Preparing Claude OAuth flow...')

      const authUrl = prepareClaudeOAuth()

      log.info('[Onboarding] Claude OAuth URL generated (client will open browser)')
      return { success: true, authUrl }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.error('[Onboarding] Prepare Claude OAuth error:', message)
      return { success: false, error: message }
    }
  })

  // Exchange authorization code for tokens
  server.handle(RPC_CHANNELS.onboarding.EXCHANGE_CLAUDE_CODE, async (_ctx, authorizationCode: unknown, connectionSlug: unknown) => {
    try {
      const parsedCode = parseAuthCode('authorizationCode', authorizationCode)
      const parsedSlug = parseId('connectionSlug', connectionSlug)
      log.info(`[Onboarding] Exchanging Claude authorization code for connection: ${parsedSlug}`)

      if (!hasValidOAuthState()) {
        log.error('[Onboarding] No valid OAuth state found')
        return { success: false, error: 'OAuth session expired. Please start again.' }
      }

      const tokens = await exchangeClaudeCode(parsedCode, (status) => {
        log.info('[Onboarding] Claude code exchange status:', status)
      })

      // Save credentials with refresh token support
      const manager = getCredentialManager()

      // Save to new LLM connection system
      await manager.setLlmOAuth(parsedSlug, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      })

      // Also save to legacy key for validation compatibility
      await manager.setClaudeOAuthCredentials({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        source: 'native',
      })

      const expiresAtDate = tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : 'never'
      log.info(`[Onboarding] Claude OAuth saved to LLM connection (expires: ${expiresAtDate})`)
      return { success: true, token: tokens.accessToken }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      log.error('[Onboarding] Exchange Claude code error:', message)
      return { success: false, error: message }
    }
  })

  // Check if there's a valid OAuth state in progress
  server.handle(RPC_CHANNELS.onboarding.HAS_CLAUDE_OAUTH_STATE, async () => {
    return hasValidOAuthState()
  })

  // Clear OAuth state (for cancel/reset)
  server.handle(RPC_CHANNELS.onboarding.CLEAR_CLAUDE_OAUTH_STATE, async () => {
    clearOAuthState()
    return { success: true }
  })

  // User chose "Setup later" — persist so onboarding doesn't re-show on next launch
  server.handle(RPC_CHANNELS.onboarding.DEFER_SETUP, async () => {
    setSetupDeferred(true)
    log?.info('[Onboarding] User deferred setup')
    return { success: true }
  })
}
