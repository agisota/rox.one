/**
 * RTL tests for SidecarCrashBanner (PZD-81 follow-up).
 *
 * Coverage:
 *   1. banner-appears-on-crash — onRoxDesignSidecarExited fires → banner renders
 *   2. retry-calls-start-and-dismisses-on-success — retry button → start() → banner hides
 *   3. retry-failure-keeps-banner-visible — start() rejects → banner stays, button re-enabled
 *   4. dismiss-hides-without-retry — dismiss button → banner hides, start() NOT called
 *   5. renders-RU-strings-with-ru-locale — language=ru → Russian title text
 */

import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '../../../../test-utils/render'
import i18n from 'i18next'
import type { RoxDesignSidecarExitedPayload } from '../../../../shared/types'

// Mock Sentry to avoid touching the actual telemetry pipeline in tests.
vi.mock('@sentry/electron/renderer', () => ({
  addBreadcrumb: vi.fn(),
}))

import { SidecarCrashBanner } from '../SidecarCrashBanner'

type SidecarCallback = (payload: RoxDesignSidecarExitedPayload) => void

function installApi(opts: {
  start?: () => Promise<unknown>
} = {}) {
  let storedCb: SidecarCallback | null = null
  const start = opts.start ?? vi.fn(async () => ({ status: 'running' as const }))
  const onRoxDesignSidecarExited = vi.fn((cb: SidecarCallback) => {
    storedCb = cb
    return vi.fn() // unsubscribe
  })
  ;(window as any).electronAPI = {
    ...(window as any).electronAPI,
    onRoxDesignSidecarExited,
    roxDesign: {
      start,
      getStatus: vi.fn(async () => ({ status: 'idle' as const })),
      stop: vi.fn(async () => ({ status: 'idle' as const })),
      show: vi.fn(async () => ({ status: 'shown' })),
      setBounds: vi.fn(async () => {}),
      hide: vi.fn(async () => {}),
      openExternal: vi.fn(async () => {}),
    },
  }
  return {
    start,
    onRoxDesignSidecarExited,
    fireCrash: (payload: RoxDesignSidecarExitedPayload) => {
      if (!storedCb) throw new Error('onRoxDesignSidecarExited not subscribed')
      act(() => storedCb!(payload))
    },
  }
}

afterEach(() => {
  cleanup()
  delete (window as any).electronAPI
  vi.clearAllMocks()
})

describe('SidecarCrashBanner', () => {
  it('banner-appears-on-crash: renders title + body after a crash event', () => {
    const { fireCrash } = installApi()
    render(<SidecarCrashBanner />)

    expect(screen.queryByTestId('sidecar-crash-banner')).toBeNull()

    fireCrash({ reason: 'sidecar exited code=137', code: 137 })

    const banner = screen.getByTestId('sidecar-crash-banner')
    expect(banner).toBeTruthy()
    expect(banner.textContent).toContain('roxDesign.crashRecovery.title')
    expect(banner.textContent).toContain('roxDesign.crashRecovery.body')
  })

  it('retry-calls-start-and-dismisses-on-success: retry → start() → banner hidden', async () => {
    const { start, fireCrash } = installApi()
    render(<SidecarCrashBanner />)

    fireCrash({ reason: 'crash', code: 1 })
    expect(screen.getByTestId('sidecar-crash-banner')).toBeTruthy()

    const retryBtn = screen.getByRole('button', { name: /roxDesign\.crashRecovery\.retry/i })
    fireEvent.click(retryBtn)

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByTestId('sidecar-crash-banner')).toBeNull())
  })

  it('retry-failure-keeps-banner-visible: start() rejects → banner stays + button re-enabled', async () => {
    const start = vi.fn(async () => {
      throw new Error('start failed')
    })
    const { fireCrash } = installApi({ start })
    render(<SidecarCrashBanner />)

    fireCrash({ reason: 'crash', code: 1 })
    expect(screen.getByTestId('sidecar-crash-banner')).toBeTruthy()

    const retryBtn = screen.getByRole('button', { name: /roxDesign\.crashRecovery\.retry/i })
    fireEvent.click(retryBtn)

    await waitFor(() => expect(start).toHaveBeenCalledTimes(1))

    // Banner still visible after failure
    expect(screen.getByTestId('sidecar-crash-banner')).toBeTruthy()
    // Button re-enabled
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /roxDesign\.crashRecovery\.retry/i })
      expect((btn as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('dismiss-hides-without-retry: dismiss → banner hidden, start() not called', () => {
    const { start, fireCrash } = installApi()
    render(<SidecarCrashBanner />)

    fireCrash({ reason: 'crash', code: 1 })
    expect(screen.getByTestId('sidecar-crash-banner')).toBeTruthy()

    const dismissBtn = screen.getByRole('button', { name: /roxDesign\.crashRecovery\.dismiss/i })
    fireEvent.click(dismissBtn)

    expect(screen.queryByTestId('sidecar-crash-banner')).toBeNull()
    expect(start).not.toHaveBeenCalled()
  })

  it('renders-RU-strings-with-ru-locale: ru locale shows Russian title', async () => {
    // Inject ru bundle with the production keys, then switch language for this test only.
    i18n.addResourceBundle('ru', 'translation', {
      'roxDesign.crashRecovery.title': 'Rox Design отключился неожиданно',
      'roxDesign.crashRecovery.body': 'Перезапуск встроенной среды восстановит вашу сессию.',
      'roxDesign.crashRecovery.retry': 'Перезапустить',
      'roxDesign.crashRecovery.dismiss': 'Скрыть',
    }, true, true)
    const previousLang = i18n.language
    await i18n.changeLanguage('ru')

    try {
      const { fireCrash } = installApi()
      render(<SidecarCrashBanner />)
      fireCrash({ reason: 'crash', code: 1 })

      const banner = screen.getByTestId('sidecar-crash-banner')
      expect(banner.textContent).toContain('Rox Design отключился')
      expect(banner.textContent).toContain('Перезапустить')
      expect(banner.textContent).toContain('Скрыть')
    } finally {
      await i18n.changeLanguage(previousLang)
    }
  })
})
