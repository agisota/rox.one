/**
 * RTL render wrapper that injects providers the composer surface depends on.
 *
 * Usage:
 *   import { render } from '@/test-utils/render'
 *   const { container } = render(<FreeFormInput {...props} />)
 *   await expectNoA11yViolations(container)
 */
import * as React from 'react'
import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react'
import { Provider as JotaiProvider, createStore } from 'jotai'
import { I18nextProvider } from 'react-i18next'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { TooltipProvider } from '@rox-agent/ui'
import { ReducedMotionProvider } from '@/context/ReducedMotionContext'

// Initialize a minimal i18n instance for tests. Real translations are not
// loaded; tests should use string keys directly OR pass `t={(key) => key}`.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {},
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnEmptyString: false,
    parseMissingKeyHandler: (key) => key,  // missing keys return the key itself
  })
}

interface ComposerHarnessProps {
  children: React.ReactNode
  /** Optional Jotai store override for atom-driven tests. */
  store?: ReturnType<typeof createStore>
}

/**
 * TestComposerHarness wraps a tree with the providers the composer relies on:
 * - Jotai (atoms used by FreeFormInput, ChatInputZone, etc.)
 * - i18n (t() returns the key as fallback)
 * - ReducedMotionProvider (so motion/react integration paths run)
 * - TooltipProvider (every Radix Tooltip in the composer requires it)
 *
 * Add other providers (ThemeProvider, AppShellContext) here as needed when
 * specific tests require them. Default minimal harness keeps each test fast.
 */
export function TestComposerHarness({ children, store }: ComposerHarnessProps): React.ReactElement {
  const jotaiStore = store ?? createStore()
  return (
    <JotaiProvider store={jotaiStore}>
      <I18nextProvider i18n={i18n}>
        <ReducedMotionProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ReducedMotionProvider>
      </I18nextProvider>
    </JotaiProvider>
  )
}

/**
 * Drop-in replacement for @testing-library/react's `render` that wraps the
 * tree in TestComposerHarness.
 */
export function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { store?: ReturnType<typeof createStore> },
): RenderResult {
  const { store, ...rest } = options ?? {}
  return rtlRender(ui, {
    ...rest,
    wrapper: ({ children }) => <TestComposerHarness store={store}>{children}</TestComposerHarness>,
  })
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
