import { mergeConfig, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import sharedConfig from '../../vitest.shared.config'

/**
 * Vitest config scoped to RTL tests (*.rtl.test.tsx).
 *
 * Bun's native test runner remains the default for unit + integration tests.
 * Vitest is invoked via `bun run test:rtl` for tests that need a DOM (TipTap
 * contentEditable, cmdk, axe-core, motion/react).
 *
 * Extends vitest.shared.config.ts for common coverage/globals defaults.
 */
export default mergeConfig(sharedConfig, defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      // Mirror vite.config.ts aliases so renderer source compiles under vitest.
      '@config': resolve(__dirname, '../../packages/shared/src/config'),
      // Artifact viewer packages — mirrors tsconfig paths so tests resolve them.
      '@rox-one/artifact-viewer-core': resolve(__dirname, '../../packages/artifact-viewer-core/src/index.ts'),
      '@rox-one/artifact-viewer-core/registry': resolve(__dirname, '../../packages/artifact-viewer-core/src/registry.ts'),
      '@rox-one/artifact-viewer-core/types': resolve(__dirname, '../../packages/artifact-viewer-core/src/types.ts'),
      '@rox-one/artifact-viewer-md': resolve(__dirname, '../../packages/artifact-viewer-md/src/index.ts'),
      '@rox-one/artifact-viewer-md/register': resolve(__dirname, '../../packages/artifact-viewer-md/src/register.ts'),
      '@rox-one/artifact-viewer-md/adapter': resolve(__dirname, '../../packages/artifact-viewer-md/src/md-adapter.ts'),
      '@rox-one/artifact-viewer-browser': resolve(__dirname, '../../packages/artifact-viewer-browser/src/index.ts'),
      '@rox-one/artifact-viewer-browser/register': resolve(__dirname, '../../packages/artifact-viewer-browser/src/register.ts'),
      '@rox-one/artifact-viewer-browser/adapter': resolve(__dirname, '../../packages/artifact-viewer-browser/src/browser-adapter.ts'),
      '@rox-one/artifact-viewer-docx': resolve(__dirname, '../../packages/artifact-viewer-docx/src/index.ts'),
      '@rox-one/artifact-viewer-docx/register': resolve(__dirname, '../../packages/artifact-viewer-docx/src/register.ts'),
      '@rox-one/artifact-viewer-xlsx': resolve(__dirname, '../../packages/artifact-viewer-xlsx/src/index.ts'),
      '@rox-one/artifact-viewer-xlsx/register': resolve(__dirname, '../../packages/artifact-viewer-xlsx/src/register.ts'),
      '@rox-one/artifact-viewer-pptx': resolve(__dirname, '../../packages/artifact-viewer-pptx/src/index.ts'),
      '@rox-one/artifact-viewer-pptx/register': resolve(__dirname, '../../packages/artifact-viewer-pptx/src/register.ts'),
      '@rox-one/artifact-viewer-figma': resolve(__dirname, '../../packages/artifact-viewer-figma/src/index.ts'),
      '@rox-one/artifact-viewer-figma/register': resolve(__dirname, '../../packages/artifact-viewer-figma/src/register.ts'),
      // Force a single React copy (deduped at the root) — same reason as
      // vite.config.ts: '@rox-one/ui' otherwise pulls in a second copy.
      'react': resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    include: ['src/**/*.rtl.test.tsx'],
    environment: 'happy-dom',
    setupFiles: ['./src/test-utils/vitest-setup.ts'],
    coverage: {
      include: ['src/renderer/components/**/*.{ts,tsx}'],
    },
  },
}))
