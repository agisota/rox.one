/**
 * Headless Bun entry point — runs the Rox Agent server without Electron.
 *
 * Usage:
 *   ROX_SERVER_TOKEN=<secret> bun run src/server/index.ts
 *
 * Environment:
 *   ROX_SERVER_TOKEN   — required unless options override in host bootstrap
 *   ROX_RPC_HOST       — bind address (default: 127.0.0.1)
 *   ROX_RPC_PORT       — bind port (default: 9100)
 *   ROX_APP_ROOT       — app root path (default: cwd)
 *   ROX_RESOURCES_PATH — resources path (default: cwd/resources)
 *   ROX_IS_PACKAGED    — 'true' for production (default: false)
 *   ROX_VERSION        — app version (default: 0.0.0-dev)
 *   ROX_DEBUG          — 'true' for debug logging
 */

process.env.ROX_IS_PACKAGED ??= 'false'

await import('./start.ts')
