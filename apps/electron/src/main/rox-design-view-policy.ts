import type { RoxDesignBounds } from '../shared/types'

export interface RoxDesignRectangle {
  x: number
  y: number
  width: number
  height: number
}

export type RoxDesignNavigationDecision =
  | { action: 'allow' }
  | { action: 'external'; url: string }
  | { action: 'deny' }

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function sanitizeRoxDesignBounds(bounds: RoxDesignBounds): RoxDesignRectangle | null {
  const values = [bounds.x, bounds.y, bounds.width, bounds.height]
  if (!values.every(Number.isFinite)) return null
  if (bounds.width <= 0 || bounds.height <= 0) return null

  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  }
}

export function scaleRoxDesignBounds(bounds: RoxDesignRectangle, zoomFactor: number): RoxDesignRectangle {
  const scale = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1
  return {
    x: Math.max(0, Math.round(bounds.x * scale)),
    y: Math.max(0, Math.round(bounds.y * scale)),
    width: Math.max(1, Math.round(bounds.width * scale)),
    height: Math.max(1, Math.round(bounds.height * scale)),
  }
}

export function getRoxDesignNavigationDecision(currentUrl: string | null, nextUrl: string): RoxDesignNavigationDecision {
  if (!isHttpUrl(nextUrl)) return { action: 'deny' }
  if (!currentUrl) return { action: 'allow' }

  try {
    const current = new URL(currentUrl)
    const next = new URL(nextUrl)
    if (current.origin === next.origin) return { action: 'allow' }
    return { action: 'external', url: next.toString() }
  } catch {
    return { action: 'deny' }
  }
}

// Confused-deputy guard: the renderer supplies the URL to load into the
// privileged Rox Design WebContentsView. Without an origin pin a compromised
// or XSS-affected main renderer could redirect that view to an attacker host
// which then inherits the `rox-design-bridge:*` IPC surface.
export function isRoxDesignUrlOriginAuthorized(expectedWebUrl: string | null, candidateUrl: string): boolean {
  if (!isHttpUrl(candidateUrl)) return false
  if (!expectedWebUrl) return false
  try {
    return new URL(expectedWebUrl).origin === new URL(candidateUrl).origin
  } catch {
    return false
  }
}
