/**
 * Vitest setup — runs before each test file.
 *
 * - Registers @testing-library/jest-dom matchers (if available; optional).
 * - Provides a minimal matchMedia polyfill so ReducedMotionProvider works
 *   under happy-dom.
 * - Provides a baseline window.electronAPI stub so renderer modules whose
 *   top-level code reads `window.electronAPI.getRuntimeEnvironment()` (e.g.
 *   SessionFilesSection.tsx) don't throw at import time. Tests can override
 *   the surface per-suite via direct assignment.
 * - Provides a baseline ResizeObserver shim because happy-dom doesn't ship one
 *   and components like FreeFormInput observe their own container.
 */

// Minimal matchMedia polyfill for happy-dom (which doesn't ship one).
// Tests can override via vi.stubGlobal('matchMedia', ...) to simulate
// prefers-reduced-motion: reduce or other queries.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},  // legacy
      removeListener: () => {},  // legacy
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// Baseline electronAPI stub. Tests that need specific responses extend or
// replace this in a beforeEach. The minimum surface here covers module-init
// reads (getRuntimeEnvironment) and the small set of input-settings getters
// FreeFormInput pings on mount.
if (typeof window !== 'undefined' && typeof (window as unknown as { electronAPI?: unknown }).electronAPI === 'undefined') {
  Object.defineProperty(window, 'electronAPI', {
    writable: true,
    configurable: true,
    value: {
      getRuntimeEnvironment: () => 'electron',
      getAutoCapitalisation: () => Promise.resolve(false),
      getSendMessageKey: () => Promise.resolve('enter'),
      getSpellCheck: () => Promise.resolve(false),
      getHomeDir: () => Promise.resolve('/home/test'),
      getPendingPlanExecution: () => Promise.resolve(null),
      sessionCommand: () => Promise.resolve({ success: true }),
      generateThumbnail: () => Promise.resolve(null),
      getFilePath: () => null,
      saveLlmConnection: () => Promise.resolve({ success: true }),
      getGitBranch: () => Promise.resolve(null),
    },
  })
}

// happy-dom does not ship ResizeObserver. FreeFormInput uses one to forward
// its container height; without this shim, the constructor call throws.
if (typeof globalThis.ResizeObserver === 'undefined') {
  ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
}
