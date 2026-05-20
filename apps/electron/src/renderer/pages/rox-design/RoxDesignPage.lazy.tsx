/**
 * RoxDesignPage.lazy.tsx (T537 PR #5a)
 *
 * React.lazy wrapper for RoxDesignPage. Ensures the Design surface code
 * is split into its own dynamic chunk and is NOT included in the initial
 * JS bundle. The chunk is only loaded when the user opens the Design panel.
 *
 * Usage in AppShell (replacing the direct import):
 *   import { LazyRoxDesignPage, RoxDesignSuspenseFallback } from './RoxDesignPage.lazy'
 *   // then wrap usage in <React.Suspense fallback={<RoxDesignSuspenseFallback />}>
 */

import * as React from 'react'

/**
 * Lazy-loaded RoxDesignPage — split into `chunks/rox-design-page.js` at build time.
 * The webpackChunkName comment is honoured by both Rollup/Vite via
 * Rollup's `/* @vite-ignore *\/`-compatible magic comment support.
 */
export const LazyRoxDesignPage = React.lazy(() =>
  import(/* webpackChunkName: 'rox-design-page' */ './RoxDesignPage').then((m) => ({
    default: m.RoxDesignPage,
  }))
)

/**
 * Skeleton fallback shown while the Design chunk is loading.
 * Matches the rox-design visual language: Palette icon + muted text,
 * no spinner (loads fast on local disk; spinner would flash briefly).
 */
export function RoxDesignSuspenseFallback(): React.JSX.Element {
  return (
    <section
      className="flex h-full items-center justify-center bg-background px-6"
      aria-label="Rox Design загружается"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 px-5 py-4 shadow-minimal">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5">
          {/* Static SVG palette icon — avoids importing lucide in the initial chunk */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-foreground"
          >
            <circle cx="13.5" cy="6.5" r=".5" />
            <circle cx="17.5" cy="10.5" r=".5" />
            <circle cx="8.5" cy="7.5" r=".5" />
            <circle cx="6.5" cy="12.5" r=".5" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">Rox Design</p>
          <p className="text-sm text-muted-foreground">Загружаем панель дизайна…</p>
        </div>
      </div>
    </section>
  )
}
