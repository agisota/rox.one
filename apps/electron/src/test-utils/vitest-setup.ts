/**
 * Vitest setup — runs before each test file.
 *
 * - Registers @testing-library/jest-dom matchers (if available; optional).
 * - Provides a minimal matchMedia polyfill so ReducedMotionProvider works
 *   under happy-dom.
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
