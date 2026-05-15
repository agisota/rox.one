import { defineConfig } from 'vitest/config'

/**
 * Shared Vitest base configuration.
 *
 * Each package/app extends this via mergeConfig() and supplies
 * package-specific overrides (environment, setupFiles, include patterns,
 * resolve aliases).  Only settings that are universal across all vitest
 * consumers live here.
 *
 * Usage:
 *   import { mergeConfig, defineConfig } from 'vitest/config'
 *   import sharedConfig from '../../vitest.shared.config'
 *
 *   export default mergeConfig(sharedConfig, defineConfig({ ... }))
 */
export default defineConfig({
  test: {
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json'],
      exclude: ['**/__tests__/**', '**/*.test.*', '**/*.rtl.test.*'],
    },
  },
})
