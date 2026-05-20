/**
 * PZD-79 G.2.2.1.C — integration-agnostic URL allowlist + navigation primitives.
 *
 * Generalization of the trust-boundary helpers introduced in PZD-65 for the
 * Rox Design surface (`rox-design-view-policy.ts`). Audit finding A-H1 (URL
 * origin pinning) is enforced here.
 *
 * Every integration that spawns a WebContentsView SHOULD route navigation
 * decisions through `decideNavigation` so cross-origin loads are externalized
 * to the OS shell, and unknown-scheme URLs are denied outright.
 */

export type NavigationDecision =
  | { action: 'allow' }
  | { action: 'external'; url: string }
  | { action: 'deny' }

/** Returns true only for http: and https:; everything else (file:, data:, javascript:, …) is denied. */
export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Returns true when `candidate` parses as http(s) AND its origin matches the
 * origin of any URL in `allowlist`. Malformed entries are skipped silently so
 * one bad config entry does not poison the rest.
 *
 * Empty / null / undefined allowlist denies all.
 */
export function isUrlOriginAuthorized(allowlist: readonly string[], candidate: string): boolean {
  if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) return false
  if (!isHttpUrl(candidate)) return false

  let candidateOrigin: string
  try {
    candidateOrigin = new URL(candidate).origin
  } catch {
    return false
  }

  for (const entry of allowlist) {
    try {
      const entryOrigin = new URL(entry).origin
      if (entryOrigin === candidateOrigin) return true
    } catch {
      // Skip malformed allowlist entry.
    }
  }
  return false
}

/**
 * Decide what to do when a WebContentsView attempts to navigate from
 * `currentUrl` to `nextUrl`, gated by an explicit allowlist of origins.
 *
 * Decision matrix:
 *   - next is not http(s)               → deny
 *   - currentUrl is null
 *       and next is in allowlist        → allow (initial load into an authorized origin)
 *       otherwise                        → deny
 *   - same-origin
 *       and origin is in allowlist      → allow
 *       otherwise                        → deny  (defense in depth: A-H1)
 *   - cross-origin http(s)              → external (open in OS browser)
 *
 * Defense in depth: even same-origin navigation is denied if the origin
 * itself is not on the allowlist — this prevents an attacker who has already
 * compromised one frame from chaining further loads within the same view.
 */
export function decideNavigation(
  currentUrl: string | null,
  nextUrl: string,
  allowlist: readonly string[],
): NavigationDecision {
  if (!isHttpUrl(nextUrl)) return { action: 'deny' }

  const nextAuthorized = isUrlOriginAuthorized(allowlist, nextUrl)

  if (!currentUrl) {
    return nextAuthorized ? { action: 'allow' } : { action: 'deny' }
  }

  let currentOrigin: string
  let nextOrigin: string
  try {
    currentOrigin = new URL(currentUrl).origin
    nextOrigin = new URL(nextUrl).origin
  } catch {
    return { action: 'deny' }
  }

  if (currentOrigin === nextOrigin) {
    return nextAuthorized ? { action: 'allow' } : { action: 'deny' }
  }

  // Cross-origin http(s): externalize to OS shell.
  return { action: 'external', url: nextUrl }
}

/**
 * Backward-compatible decision shape used by Rox Design before PZD-79 hardened
 * the allowlist semantics. Same-origin → allow; cross-origin http(s) →
 * external; non-http → deny. No allowlist consultation.
 *
 * New integrations MUST use {@link decideNavigation} with an explicit
 * allowlist. This helper exists only to preserve the existing Rox Design
 * behavior while PZD-65/A-H1 origin pinning is rolled out in a follow-up.
 */
export function decideNavigationSameOriginOnly(
  currentUrl: string | null,
  nextUrl: string,
): NavigationDecision {
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
