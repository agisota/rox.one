import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { getElectronRendererManualChunk } from './vite.manual-chunks'

// NOTE: Source map upload to Sentry is intentionally disabled.
// To re-enable, uncomment the sentryVitePlugin below and add SENTRY_AUTH_TOKEN,
// SENTRY_ORG, SENTRY_PROJECT to CI secrets. See CLAUDE.md "Sentry Error Tracking" section.
// import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ command }) => {
  // Playground is a dev-only component browser. Exclude it from production builds
  // to avoid shipping ~784 KB of mock/demo code to end users.
  // Engineers can still access it in dev mode (vite serve / bun run dev).
  const isDev = command === 'serve'

  return {
  plugins: [
    react(isDev
      ? {
          babel: {
            plugins: [
              // Dev-only Jotai HMR support: production builds avoid deprecated
              // jotai/babel transforms until a jotai-babel migration is explicit.
              'jotai/babel/plugin-debug-label',
              ['jotai/babel/plugin-react-refresh', { customAtomNames: ['atomFamily'] }],
            ],
          },
        }
      : {}),
    tailwindcss(),
    // Sentry source map upload — intentionally disabled. See CLAUDE.md for re-enabling instructions.
    // sentryVitePlugin({
    //   org: process.env.SENTRY_ORG,
    //   project: process.env.SENTRY_PROJECT,
    //   authToken: process.env.SENTRY_AUTH_TOKEN,
    //   disable: !process.env.SENTRY_AUTH_TOKEN,
    //   sourcemaps: {
    //     filesToDeleteAfterUpload: ['**/*.map'],
    //   },
    // }),
  ],
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyDirBeforeWrite: true,
    sourcemap: isDev,  // Source maps in dev only; disabled for production to avoid leaking .map files into the shipped bundle.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        // playground entry is intentionally omitted from production builds.
        // It is available in dev mode (vite serve) via playground.html.
        ...(isDev && {
          playground: resolve(__dirname, 'src/renderer/playground.html'),
        }),
        'browser-toolbar': resolve(__dirname, 'src/renderer/browser-toolbar.html'),
        'browser-empty-state': resolve(__dirname, 'src/renderer/browser-empty-state.html'),
      },
      output: {
        // T132: give lazy-split chunks stable, human-readable names in dist artifacts.
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name ?? 'chunk'
          return `assets/${name}-[hash].js`
        },
        // T132e (RC1 blocker): force heavy vendor libs out of the `main` entry chunk
        // so the app-shell entry stays under the 400 KB gz carve-out ceiling. Each
        // bucket gets its own named chunk. The chunk names below intentionally
        // start with `index-` so they match the existing `index-*.js` carve-out
        // pattern in docs/release/bundle-budget-carveouts.json (ceiling 1.5 MB gz),
        // mirroring the previous behavior where these modules all lived in the
        // single index-*.js chunk before T132e redistribution.
        //   - sonner-*           (toast lib; <Toaster /> mounts from main.tsx)
        //   - sentry-*           (@sentry/react + @sentry/electron + integrations)
        //   - i18n-*             (i18next + react-i18next + LanguageDetector)
        //   - index-react-*      (react + react-dom + scheduler — the React runtime)
        //   - index-radix-*      (@radix-ui/* primitive headless components)
        //   - index-jotai-*      (jotai state management)
        //   - index-ui-*         (@rox-one/ui — internal design-system package)
        // Without these explicit buckets, the auto-chunker keeps these modules in
        // whichever entry first imports them, inflating main-*.js past budget.
        // Rollup may emit "circular chunk" warnings for the index-* buckets —
        // the chunks still execute correctly because the cycles resolve at
        // runtime through ESM live bindings (same semantics as Webpack
        // splitChunks). The pre-T132e build collapsed all of this into a single
        // index-*.js chunk and shipped fine.
        manualChunks: getElectronRendererManualChunk,
      },
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@config': resolve(__dirname, '../../packages/shared/src/config'),
      // Force all React imports to use the root node_modules React
      // Bun hoists deps to root. This prevents "multiple React copies" error from @rox-one/ui
      'react': resolve(__dirname, '../../node_modules/react'),
      'react-dom': resolve(__dirname, '../../node_modules/react-dom'),
      // Browser shim for node:async_hooks — the observability module imports
      // AsyncLocalStorage for correlation-ID propagation across async boundaries.
      // That's a server/main-process concern only; in the renderer the shim
      // returns undefined from getStore() so correlation IDs simply won't
      // propagate across async hops (they're not meaningful there anyway).
      'node:async_hooks': resolve(__dirname, 'src/renderer/shims/async-hooks.ts'),
    },
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'jotai', 'pdfjs-dist'],
    exclude: ['@rox-one/ui'],
    esbuildOptions: {
      supported: { 'top-level-await': true },
      target: 'esnext'
    }
  },
  server: {
    port: 5173,
    open: false
  }
  }
})
