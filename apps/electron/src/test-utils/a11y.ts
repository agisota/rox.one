/**
 * a11y test helper — runs axe-core against an HTML string or live Element and
 * throws a readable error when WCAG 2.x violations are present.
 *
 * Pillar 1 / T180 deliverable. Defers its own test coverage to Pillar 2's
 * Vitest+happy-dom configuration (T186), because bun:test does not provide a
 * DOM and axe-core requires one. Until then this helper is unit-tested
 * indirectly via the per-component a11y tests added in T181-T185.
 *
 * Usage (in a test file run under Vitest with happy-dom):
 *   import { render } from '@testing-library/react'
 *   import { expectNoA11yViolations } from '@/test-utils/a11y'
 *
 *   it('has no a11y violations', async () => {
 *     const { container } = render(<MyComponent />)
 *     await expectNoA11yViolations(container)
 *   })
 *
 * Or with raw HTML (uses DOMParser, never innerHTML):
 *   await expectNoA11yViolations('<button>missing accessible name</button>')
 *   // throws AxeViolationsError with details about the button-name violation
 */

import axe from 'axe-core'
import type { AxeResults, Result, RunOptions, Spec } from 'axe-core'

/** WCAG rule sets we enforce. Mirrors packages/audit's runtime-axe probe. */
const DEFAULT_RUN_OPTIONS: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
  },
  resultTypes: ['violations'],
}

export class AxeViolationsError extends Error {
  readonly violations: Result[]

  constructor(violations: Result[]) {
    const summary = violations
      .map((v) => {
        const nodes = v.nodes
          .map((n) => `      - target: ${n.target.join(' ')}`)
          .join('\n')
        return [
          `  • [${v.impact ?? 'unknown'}] ${v.id}: ${v.help}`,
          `    help: ${v.helpUrl}`,
          nodes,
        ].join('\n')
      })
      .join('\n')
    super(`A11y violations found (${violations.length}):\n${summary}`)
    this.name = 'AxeViolationsError'
    this.violations = violations
  }
}

/**
 * Parse an HTML fragment string into a DOM tree without using innerHTML.
 * Returns a host element appended to document.body whose children mirror the
 * input fragment. Caller is responsible for removing it via the returned
 * cleanup function.
 *
 * Uses DOMParser (browser-standard, available in jsdom/happy-dom). Avoids
 * direct innerHTML assignment.
 */
function mountFragment(html: string): { host: HTMLElement; cleanup: () => void } {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(html, 'text/html')
  const host = document.createElement('div')
  // Move (not clone) every child node from the parsed body into the host.
  // This avoids the innerHTML setter on `host` entirely.
  while (parsed.body.firstChild) {
    host.appendChild(parsed.body.firstChild)
  }
  document.body.appendChild(host)
  const cleanup = (): void => {
    if (host.parentNode) host.parentNode.removeChild(host)
  }
  return { host, cleanup }
}

/**
 * Run axe-core against a target. Throws AxeViolationsError on violations.
 *
 * @param target Either an HTML string or a live DOM Element / Document.
 * @param overrides Optional axe RunOptions merged over the WCAG defaults.
 *
 * Requires a DOM. Run under Vitest+happy-dom (T186) or pass an Element from
 * @testing-library/react. Throws a clear setup error if `document` is missing.
 */
export async function expectNoA11yViolations(
  target: string | Element | Document,
  overrides?: RunOptions,
): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error(
      'expectNoA11yViolations: no DOM available. Run this test via the Vitest config introduced in T186 (uses happy-dom), or wrap an Element rendered by @testing-library/react.',
    )
  }

  let context: Element | Document
  let cleanup: (() => void) | null = null

  if (typeof target === 'string') {
    const mounted = mountFragment(target)
    context = mounted.host
    cleanup = mounted.cleanup
  } else {
    context = target
  }

  try {
    const options: RunOptions = { ...DEFAULT_RUN_OPTIONS, ...overrides }
    const results: AxeResults = await axe.run(context, options)
    if (results.violations.length > 0) {
      throw new AxeViolationsError(results.violations)
    }
  } finally {
    cleanup?.()
  }
}

/**
 * Lower-level escape hatch: returns the full AxeResults instead of throwing.
 * Useful when a test wants to assert on a specific subset of violations OR
 * verify violations exist (e.g., the failing-fixture pattern in TDD).
 */
export async function runAxe(
  target: Element | Document | string,
  overrides?: RunOptions,
): Promise<AxeResults> {
  if (typeof document === 'undefined') {
    throw new Error('runAxe: no DOM available. See expectNoA11yViolations docstring.')
  }
  let context: Element | Document
  let cleanup: (() => void) | null = null
  if (typeof target === 'string') {
    const mounted = mountFragment(target)
    context = mounted.host
    cleanup = mounted.cleanup
  } else {
    context = target
  }
  try {
    const options: RunOptions = { ...DEFAULT_RUN_OPTIONS, ...overrides }
    return await axe.run(context, options)
  } finally {
    cleanup?.()
  }
}

/** Re-export common axe types for downstream test files. */
export type { AxeResults, Result, RunOptions, Spec }
