import * as React from 'react'

const ReducedMotionContext = React.createContext<boolean>(false)

function useMediaReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

/**
 * Provides the user's `prefers-reduced-motion` preference via React context AND
 * sets `data-reduced-motion="true"` on `<html>` so a global CSS rule can disable
 * Tailwind animate-* and CSS transitions outside motion/react's reach.
 *
 * Mount once near the renderer root.
 *
 * Note: motion/react's `useReducedMotion` is not exported in the version used by
 * this project (motion/react re-exports framer-motion which lacks it here), so we
 * use the native `window.matchMedia` API directly.
 */
export function ReducedMotionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useMediaReducedMotion()

  React.useEffect(() => {
    const root = document.documentElement
    if (reduced) root.setAttribute('data-reduced-motion', 'true')
    else root.removeAttribute('data-reduced-motion')
    return () => root.removeAttribute('data-reduced-motion')
  }, [reduced])

  return (
    <ReducedMotionContext.Provider value={reduced}>
      {children}
    </ReducedMotionContext.Provider>
  )
}

/** Returns true when `prefers-reduced-motion: reduce` is active. */
export function useReducedMotionPreference(): boolean {
  return React.useContext(ReducedMotionContext)
}
