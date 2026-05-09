import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

/**
 * Vitest config scoped to RTL tests (*.rtl.test.tsx).
 *
 * Bun's native test runner remains the default for unit + integration tests.
 * Vitest is invoked via `bun run test:rtl` for tests that need a DOM (TipTap
 * contentEditable, cmdk, axe-core, motion/react).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      // Mirror vite.config.ts aliases so renderer source compiles under vitest.
      '@config': resolve(__dirname, '../../packages/shared/src/config'),
      // Force a single React copy (deduped at the root) — same reason as
      // vite.config.ts: '@craft-agent/ui' otherwise pulls in a second copy.
      'react': resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    include: ['src/**/*.rtl.test.tsx'],
    environment: 'happy-dom',
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json'],
      include: ['src/renderer/components/**/*.{ts,tsx}'],
      exclude: ['**/__tests__/**', '**/*.test.*', '**/*.rtl.test.*'],
    },
  },
})
