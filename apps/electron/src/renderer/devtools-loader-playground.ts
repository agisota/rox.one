// React DevTools standalone server loader for the playground.
// Executed only in development (file: protocol or localhost dev server).
// The playground entry is excluded from production builds — see vite.config.ts.
if (location.protocol === 'file:' || location.hostname === 'localhost') {
  const s = document.createElement('script')
  s.src = 'http://localhost:8097'
  document.head.appendChild(s)
}
