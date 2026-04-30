#!/usr/bin/env bun
/**
 * @rox-agent/server — standalone headless ROX server.
 *
 * Usage:
 *   ROX_SERVER_TOKEN=<secret> bun run packages/server/src/index.ts
 *
 * Environment:
 *   ROX_SERVER_TOKEN         — required bearer token for client auth
 *   ROX_RPC_HOST             — bind address (default: 127.0.0.1)
 *   ROX_RPC_PORT             — bind port (default: 9100)
 *   ROX_RPC_TLS_CERT         — path to PEM certificate file (enables TLS/wss)
 *   ROX_RPC_TLS_KEY          — path to PEM private key file (required with cert)
 *   ROX_RPC_TLS_CA           — path to PEM CA chain file (optional)
 *   ROX_APP_ROOT             — app root path (default: cwd)
 *   ROX_RESOURCES_PATH       — resources path (default: cwd/resources)
 *   ROX_IS_PACKAGED          — 'true' for production (default: false)
 *   ROX_VERSION              — app version (default: 0.0.0-dev)
 *   ROX_DEBUG                — 'true' for debug logging
 *   ROX_WEBUI_DIR            — path to built web UI assets (enables web UI on RPC port)
 *   ROX_WEBUI_PASSWORD       — optional shorter password for legacy web login (falls back to ROX_SERVER_TOKEN)
 *   ROX_WEBUI_SECURE_COOKIE  — optional true/false override for the session cookie Secure flag
 *   ROX_WEBUI_WS_URL         — optional browser-facing ws:// or wss:// URL returned by /api/config
 *   ROX_WEBUI_TRUSTED_PROXIES — optional comma/space-separated proxy peer IPs allowed to set forwarded headers
 *   ROX_DATABASE_URL         — optional Postgres URL enabling hosted accounts/signup
 *   ROX_AUTH_JWT_SECRET      — optional JWT signing secret for WebUI account sessions
 *   ROX_SIGNUP_ENABLED       — optional true/false open-signup switch (default true when DB is configured)
 *   ROX_PUBLIC_APP_URL       — optional public HTTPS origin used in auth emails
 *   RESEND_API_KEY             — optional Resend API key for account verification/reset emails
 *   ROX_EMAIL_FROM           — optional sender address for account emails
 *   ROX_MESSAGING_WA_WORKER  — absolute path to worker.cjs (default: packages/messaging-whatsapp-worker/dist/worker.cjs)
 *   ROX_MESSAGING_NODE_BIN   — Node binary used to spawn the WhatsApp worker (default: node)
 */

import { join } from 'node:path'
import { homedir } from 'node:os'
import { readFileSync, existsSync } from 'node:fs'
import { version as packageVersion } from '../package.json'
import { enableDebug } from '@rox-agent/shared/utils/debug'
import { bootstrapServer, startHealthHttpServer, generateServerToken } from '@rox-agent/server-core/bootstrap'
import {
  validateSession,
  validateAccountSession,
  createWebuiHandler,
  nodeHttpAdapter,
  createAccountEmailService,
  InMemoryAccountTeamStore,
  InMemoryManagedCloudWorkspaceStore,
} from '@rox-agent/server-core/webui'
import type { WebuiHandler } from '@rox-agent/server-core/webui'
import { createPostgresAccountStore } from '@rox-agent/server-core/accounts'
import { getCredentialManager } from '@rox-agent/shared/credentials'
import { getWorkspaces } from '@rox-agent/shared/config'
import { createMessagingBootstrap, type MessagingBootstrapHandle } from '@rox-agent/messaging-gateway'

// --generate-token: print a crypto-random token and exit
if (process.argv.includes('--generate-token')) {
  console.log(generateServerToken())
  process.exit(0)
}
import type { WsRpcTlsOptions } from '@rox-agent/server-core/transport'
import { registerCoreRpcHandlers, cleanupSessionFileWatchForClient } from '@rox-agent/server-core/handlers/rpc'
import { SessionManager, setSessionPlatform, setSessionRuntimeHooks } from '@rox-agent/server-core/sessions'
import { initModelRefreshService, setFetcherPlatform } from '@rox-agent/server-core/model-fetchers'
import { setSearchPlatform, setImageProcessor } from '@rox-agent/server-core/services'
import type { HandlerDeps } from '@rox-agent/server-core/handlers'

process.env.ROX_IS_PACKAGED ??= 'false'

// Prevent unhandled rejections from crashing the server.
// SDK subprocess abort can reject promises that propagate up unhandled;
// Bun (unlike Node) terminates the process on unhandled rejections by default.
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  console.error(`[server] Unhandled rejection (caught, not crashing): ${msg}`)
})

if (process.env.ROX_DEBUG === 'true' || process.env.ROX_DEBUG === '1') {
  enableDebug()
}

function parseOptionalBooleanEnv(name: string, value: string | undefined): boolean | undefined {
  if (value == null || value.trim() === '') return undefined

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false

  console.error(`Invalid ${name}: expected one of true/false/1/0/yes/no/on/off.`)
  process.exit(1)
}

function parseOptionalWebSocketUrl(name: string, value: string | undefined): string | undefined {
  if (value == null || value.trim() === '') return undefined

  try {
    const url = new URL(value)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      throw new Error('must use ws:// or wss://')
    }
    return value
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Invalid ${name}: ${message}`)
    process.exit(1)
  }
}

function parseListEnv(value: string | undefined): string[] | undefined {
  const entries = value?.split(/[,\s]+/).map(item => item.trim()).filter(Boolean)
  return entries?.length ? entries : undefined
}

// In dev (monorepo), bundled assets root is the repo root (4 levels up from this file).
// In packaged mode, use ROX_BUNDLED_ASSETS_ROOT env or cwd.
const bundledAssetsRoot = process.env.ROX_BUNDLED_ASSETS_ROOT
  ?? join(import.meta.dir, '..', '..', '..', '..')

// TLS configuration — when cert + key paths are provided, server listens on wss://
let tls: WsRpcTlsOptions | undefined
const tlsCertPath = process.env.ROX_RPC_TLS_CERT
const tlsKeyPath = process.env.ROX_RPC_TLS_KEY
if (tlsCertPath || tlsKeyPath) {
  if (!tlsCertPath || !tlsKeyPath) {
    console.error('TLS requires both ROX_RPC_TLS_CERT and ROX_RPC_TLS_KEY.')
    process.exit(1)
  }
  tls = {
    cert: readFileSync(tlsCertPath),
    key: readFileSync(tlsKeyPath),
    ...(process.env.ROX_RPC_TLS_CA ? { ca: readFileSync(process.env.ROX_RPC_TLS_CA) } : {}),
  }
}

// Web UI configuration
const webuiDir = process.env.ROX_WEBUI_DIR || undefined
const webuiEnabled = webuiDir && existsSync(webuiDir)
const webuiSecureCookies = parseOptionalBooleanEnv('ROX_WEBUI_SECURE_COOKIE', process.env.ROX_WEBUI_SECURE_COOKIE)
const webuiWsUrl = parseOptionalWebSocketUrl('ROX_WEBUI_WS_URL', process.env.ROX_WEBUI_WS_URL)
const webuiTrustedProxies = parseListEnv(process.env.ROX_WEBUI_TRUSTED_PROXIES || process.env.ROX_TRUSTED_PROXIES)
const serverToken = process.env.ROX_SERVER_TOKEN
const authJwtSecret = process.env.ROX_AUTH_JWT_SECRET || serverToken
const signupEnabled = parseOptionalBooleanEnv('ROX_SIGNUP_ENABLED', process.env.ROX_SIGNUP_ENABLED)
const publicAppUrl = process.env.ROX_PUBLIC_APP_URL || undefined
const accountStore = process.env.ROX_DATABASE_URL
  ? createPostgresAccountStore({ connectionString: process.env.ROX_DATABASE_URL })
  : null
const accountEmailService = accountStore
  ? createAccountEmailService({
      resendApiKey: process.env.RESEND_API_KEY,
      from: process.env.ROX_EMAIL_FROM,
      logger: { info: console.log, warn: console.warn, error: console.error },
    })
  : undefined
const accountTeamStore = accountStore ? new InMemoryAccountTeamStore() : undefined
const accountCloudWorkspaceStore = accountStore ? new InMemoryManagedCloudWorkspaceStore() : undefined

if (accountStore) {
  await accountStore.migrate()
}

// ---------------------------------------------------------------------------
// Create WebUI handler early so it can be embedded in the WsRpcServer.
// The handler is a pure function — it doesn't need the session manager yet
// because health checks are injected lazily via getHealthCheck().
// ---------------------------------------------------------------------------

let webuiHandler: WebuiHandler | null = null
let webuiNodeHandler: ReturnType<typeof nodeHttpAdapter> | undefined

// Health check is injected lazily — the session manager isn't ready until
// after bootstrap completes, but the handler captures the closure.
let healthCheckFn: (() => { status: string }) | null = null

if (webuiEnabled && serverToken) {
  const rpcPort = parseInt(process.env.ROX_RPC_PORT ?? '9100', 10)
  const rpcProtocol = tls ? 'wss' as const : 'ws' as const

  webuiHandler = createWebuiHandler({
    webuiDir: webuiDir!,
    secret: accountStore ? authJwtSecret! : serverToken,
    password: process.env.ROX_WEBUI_PASSWORD || undefined,
    secureCookies: webuiSecureCookies,
    publicWsUrl: webuiWsUrl,
    wsProtocol: rpcProtocol,
    // WebUI is served on the same port as WS — wsPort matches the RPC port
    wsPort: rpcPort,
    getHealthCheck: () => healthCheckFn?.() ?? { status: 'starting' },
    logger: { info: console.log, warn: console.warn, error: console.error } as any,
    accountStore: accountStore ?? undefined,
    trustedProxies: webuiTrustedProxies,
    signupEnabled,
    publicAppUrl,
    accountEmailService,
    accountTeamStore,
    accountCloudWorkspaceStore,
    bootstrapAccount: accountStore
      ? async (user) => {
          if (await accountStore.getUserCount() !== 1) return
          for (const workspace of getWorkspaces()) {
            await accountStore.grantWorkspaceOwner(user.id, workspace.id)
          }
        }
      : undefined,
  })

  webuiNodeHandler = nodeHttpAdapter(webuiHandler.fetch)
}

// Resolve WhatsApp worker paths up-front so the helper + Docker env stay in sync.
// The worker is a Node subprocess — Bun cannot run it directly — so we must
// pass an explicit `nodeBin` (Electron defaults nodeBin to process.execPath
// which is correct there but wrong under Bun).
const waWorkerEntry = process.env.ROX_MESSAGING_WA_WORKER
  ?? join(bundledAssetsRoot, 'packages', 'messaging-whatsapp-worker', 'dist', 'worker.cjs')
const waNodeBin = process.env.ROX_MESSAGING_NODE_BIN ?? 'node'

// Built inside createHandlerDeps (needs sessionManager), populated with the WS
// publisher after bootstrapServer resolves.
let messagingHandle: MessagingBootstrapHandle | null = null

const instance = await (async () => {
  try {
    return await bootstrapServer<SessionManager, HandlerDeps>({
      bundledAssetsRoot,
      serverVersion: process.env.ROX_VERSION ?? packageVersion,
      tls,
      // When web UI is enabled, accept JWT session cookies on WebSocket upgrade
      validateSessionCookie: webuiEnabled && serverToken
        ? async (cookieHeader) => {
            if (accountStore) {
              const session = await validateAccountSession(cookieHeader, authJwtSecret!, accountStore)
              return session
                ? { userId: session.userId, sessionId: session.sessionId, email: session.email, role: session.role }
                : null
            }
            const session = await validateSession(cookieHeader, serverToken)
            return session !== null
          }
        : undefined,
      // Embed the WebUI HTTP handler on the WS server's port
      httpHandler: webuiNodeHandler,
      applyPlatformToSubsystems: (platform) => {
        setFetcherPlatform(platform)
        setSessionPlatform(platform)
        setSessionRuntimeHooks({
          updateBadgeCount: () => {},
          captureException: (error) => {
            const err = error instanceof Error ? error : new Error(String(error))
            platform.captureError?.(err)
          },
        })
        setSearchPlatform(platform)
        setImageProcessor(platform.imageProcessor)
      },
      initModelRefreshService: () => initModelRefreshService(async (slug: string) => {
        const manager = getCredentialManager()
        const [apiKey, oauth] = await Promise.all([
          manager.getLlmApiKey(slug).catch(() => null),
          manager.getLlmOAuth(slug).catch(() => null),
        ])
        return {
          apiKey: apiKey ?? undefined,
          oauthAccessToken: oauth?.accessToken,
          oauthRefreshToken: oauth?.refreshToken,
          oauthIdToken: oauth?.idToken,
        }
      }),
      createSessionManager: () => new SessionManager(),
      createHandlerDeps: ({ sessionManager, platform, oauthFlowStore }) => {
        messagingHandle = createMessagingBootstrap({
          sessionManager,
          credentialManager: getCredentialManager(),
          getMessagingDir: (wsId: string) =>
            join(homedir(), '.rox', 'workspaces', wsId, 'messaging'),
          // Headless has no legacy messaging dir — workspaces start clean.
          whatsapp: {
            workerEntry: waWorkerEntry,
            nodeBin: waNodeBin,
            pairingMode: 'qr',
          },
        })
          return {
            sessionManager,
            platform,
            oauthFlowStore,
            messagingRegistry: messagingHandle.registry,
            accountStore: accountStore ?? undefined,
          }
        },
      registerAllRpcHandlers: registerCoreRpcHandlers,
      setSessionEventSink: (sessionManager, sink) => {
        if (!messagingHandle) {
          // createHandlerDeps always runs before setSessionEventSink, but be
          // defensive in case bootstrapServer's ordering ever changes.
          sessionManager.setEventSink(sink)
          return
        }
        sessionManager.setEventSink(messagingHandle.wrapSink(sink))
      },
      initializeSessionManager: async (sessionManager) => {
        await sessionManager.initialize()
      },
      cleanupSessionManager: async (sessionManager) => {
        try {
          await sessionManager.flushAllSessions()
        } finally {
          sessionManager.cleanup()
        }
      },
      cleanupClientResources: cleanupSessionFileWatchForClient,
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
})()

// ---------------------------------------------------------------------------
// Messaging post-bootstrap: bind the WS publisher and initialize local
// workspaces. Remote-owned workspaces are skipped because their messaging
// runs on the remote server.
// ---------------------------------------------------------------------------
if (messagingHandle !== null) {
  const handle: MessagingBootstrapHandle = messagingHandle
  handle.setPublisher(instance.wsServer.push.bind(instance.wsServer))
  try {
    const localWorkspaceIds = getWorkspaces()
      .filter((ws) => !ws.remoteServer)
      .map((ws) => ws.id)
    await handle.initializeWorkspaces(localWorkspaceIds)
  } catch (error) {
    console.error('[messaging] Workspace initialization failed:', error)
  }
}

// Wire up the lazy health check now that the session manager is ready
if (webuiHandler) {
  const { getHealthCheck } = await import('@rox-agent/server-core/handlers/rpc/server')
  const depsLike = { sessionManager: instance.sessionManager } as any
  healthCheckFn = () => getHealthCheck(depsLike)

  // Wire up OAuth callback deps so /api/oauth/callback works
  const { getSourceCredentialManager, loadWorkspaceSources } = await import('@rox-agent/shared/sources')
  const { getWorkspaceByNameOrId } = await import('@rox-agent/shared/config')
  const { pushTyped } = await import('@rox-agent/server-core/transport')
  const { RPC_CHANNELS } = await import('@rox-agent/shared/protocol')

  webuiHandler.setOAuthCallbackDeps({
    flowStore: instance.oauthFlowStore,
    credManager: getSourceCredentialManager(),
    sessionManager: instance.sessionManager,
    pushSourcesChanged: (workspaceId: string) => {
      const ws = getWorkspaceByNameOrId(workspaceId)
      const sources = ws ? loadWorkspaceSources(ws.rootPath) : []
      pushTyped(instance.wsServer, RPC_CHANNELS.sources.CHANGED, { to: 'workspace', workspaceId }, workspaceId, sources)
    },
  })
}

// Start HTTP health endpoint if ROX_HEALTH_PORT is set
const healthPort = parseInt(process.env.ROX_HEALTH_PORT ?? '0', 10)
const healthServer = await startHealthHttpServer({
  port: healthPort,
  deps: { sessionManager: instance.sessionManager },
  wsServer: instance.wsServer,
  platform: instance.platform,
})

const serverProto = instance.protocol === 'wss' ? 'https' : 'http'
console.log(`ROX_SERVER_URL=${instance.protocol}://${instance.host}:${instance.port}`)
console.log(`ROX_SERVER_TOKEN=${instance.token ? `${instance.token.slice(0, 6)}…${instance.token.slice(-4)}` : ''}`)
if (webuiHandler) {
  console.log(`ROX_WEBUI_URL=${serverProto}://0.0.0.0:${instance.port}`)
}

// Block binding to a non-localhost address without TLS — tokens would be sent in cleartext.
// Override with --allow-insecure-bind for explicitly trusted networks.
const isLocalBind = instance.host === '127.0.0.1' || instance.host === 'localhost' || instance.host === '::1'
if (!isLocalBind && instance.protocol === 'ws') {
  if (process.argv.includes('--allow-insecure-bind')) {
    console.warn(
      '\n⚠️  WARNING: Server is listening on a network address without TLS.\n' +
      '   Authentication tokens will be sent in cleartext.\n' +
      '   Set ROX_RPC_TLS_CERT and ROX_RPC_TLS_KEY to enable wss://.\n'
    )
  } else {
    console.error(
      '\n❌  Refusing to bind to a network address without TLS.\n' +
      '   Authentication tokens would be sent in cleartext.\n\n' +
      '   Options:\n' +
      '     1. Set ROX_RPC_TLS_CERT and ROX_RPC_TLS_KEY to enable wss://\n' +
      '     2. Pass --allow-insecure-bind to override (NOT recommended for production)\n'
    )
    await instance.stop()
    process.exit(1)
  }
}

const shutdown = async () => {
  webuiHandler?.dispose()
  healthServer?.stop()
  if (messagingHandle) {
    try {
      await messagingHandle.dispose()
    } catch (error) {
      console.error('[messaging] dispose failed:', error)
    }
  }
  await accountStore?.close?.()
  await instance.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
