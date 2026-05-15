# T506 — Vitest config consolidation

Status: DONE
Phase: M.19
Owner: agent-A (RC2 swarm)

## Summary

Extracted a shared Vitest base configuration (`vitest.shared.config.ts`) at the
repo root and updated `apps/electron/vitest.config.ts` to extend it via
`mergeConfig()`.

## Motivation

The task specification called for consolidating per-package vitest configurations
to reduce drift and make runner behaviour consistent. Inventory revealed the repo
has only one vitest consumer (`apps/electron`) — all other packages use bun's
native test runner. The consolidation therefore creates the shared-base
infrastructure so that future packages adopting vitest start from a consistent
baseline rather than diverging from day one.

## Inventory

| Config | Before | After |
|--------|--------|-------|
| `apps/electron/vitest.config.ts` | standalone `defineConfig` | `mergeConfig(sharedConfig, defineConfig(...))` |
| `vitest.shared.config.ts` | (did not exist) | new shared base |

- Configs touched: 1 (updated) + 1 (created) = 2
- Pre-existing vitest consumers: 1 (`apps/electron` — RTL tests only)
- Packages using bun native runner: all others (no vitest config needed)

## Shared base (`vitest.shared.config.ts`)

Extracted settings universal across all vitest consumers:

- `test.globals: false`
- `test.coverage.provider: 'v8'`
- `test.coverage.reporter: ['text', 'text-summary', 'json']`
- `test.coverage.exclude: ['**/__tests__/**', '**/*.test.*', '**/*.rtl.test.*']`

## Electron-specific overrides (preserved via mergeConfig)

- `plugins: [react()]`
- `resolve.alias` (renderer path, @config, deduped react/react-dom)
- `resolve.dedupe`
- `test.include: ['src/**/*.rtl.test.tsx']`
- `test.environment: 'happy-dom'`
- `test.setupFiles`
- `test.coverage.include` (renderer components only)

## Lines of duplicate config removed

~9 lines of coverage/globals configuration removed from
`apps/electron/vitest.config.ts` (now inherited from shared base).

## Validation

- `bun run test:rtl`: 55 failed | 104 passed — matches pre-change baseline
  (pre-existing failures owned by C1/C2)
- `bun run typecheck:all`: exit 0
- `bun run test:units`: run confirmed (bun native runner unaffected by vitest
  config changes)
