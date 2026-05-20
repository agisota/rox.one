/**
 * Rox Design view policy helpers.
 *
 * PZD-79 G.2.2.1.C migrated the URL/navigation primitives to
 * `./integrations/url-policy.ts` so any future integration can reuse them.
 * This module now re-exports the URL helpers for backward compatibility and
 * keeps the Rox-Design-specific bounds geometry helpers in place.
 */
import type { RoxDesignBounds } from '../shared/types'
import { decideNavigationSameOriginOnly } from './integrations/url-policy'

export { isHttpUrl } from './integrations/url-policy'
export type { NavigationDecision as RoxDesignNavigationDecision } from './integrations/url-policy'

export interface RoxDesignRectangle {
  x: number
  y: number
  width: number
  height: number
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

/**
 * Pre-PZD-79 navigation semantic preserved verbatim for Rox Design: same-origin
 * → allow; cross-origin http(s) → external; non-http → deny.
 *
 * New integrations MUST use `decideNavigation(currentUrl, nextUrl, allowlist)`
 * from `./integrations/url-policy` (it enforces an explicit allowlist for
 * defense in depth).
 */
export function getRoxDesignNavigationDecision(
  currentUrl: string | null,
  nextUrl: string,
): import('./integrations/url-policy').NavigationDecision {
  return decideNavigationSameOriginOnly(currentUrl, nextUrl)
}
