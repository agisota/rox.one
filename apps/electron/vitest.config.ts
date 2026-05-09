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
    },
  },
  test: {
    include: ['src/**/*.rtl.test.tsx'],
    environment: 'happy-dom',
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/renderer/components/**/*.{ts,tsx}'],
      exclude: ['**/__tests__/**', '**/*.test.*', '**/*.rtl.test.*'],
    },
  },
})
