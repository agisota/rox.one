// React DevTools standalone server loader.
// Executed only when running against a local dev server (localhost).
// In production builds this file is excluded from rollup inputs, so it is
// never shipped to end users. See vite.config.ts rollupOptions.input.
if (location.hostname === 'localhost') {
  const s = document.createElement('script')
  s.src = 'http://localhost:8097'
  document.head.appendChild(s)
}
