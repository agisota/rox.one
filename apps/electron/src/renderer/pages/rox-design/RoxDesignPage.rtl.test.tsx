import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RoxDesignPage } from './RoxDesignPage'

function installRoxDesignApi(status: unknown) {
  const start = vi.fn(async () => status)
  const show = vi.fn(async () => ({ status: 'shown', webContentsId: 42, viewKind: 'webContentsView' }))
  const setBounds = vi.fn(async () => {})
  const hide = vi.fn(async () => {})
  ;(window as any).electronAPI = {
    ...(window as any).electronAPI,
    roxDesign: {
      start,
      getStatus: vi.fn(async () => status),
      stop: vi.fn(async () => status),
      show,
      setBounds,
      hide,
      openExternal: vi.fn(async () => {}),
    },
  }
  return { start, show, setBounds, hide }
}

beforeEach(() => {
  class MockResizeObserver {
    observe = vi.fn()
    disconnect = vi.fn()
    unobserve = vi.fn()
  }
  ;(globalThis as any).ResizeObserver = MockResizeObserver
})

afterEach(() => {
  cleanup()
  delete (window as any).electronAPI
})

describe('RoxDesignPage', () => {

  it('shows a recoverable error when the Electron bridge is absent', async () => {
    const previousApi = (window as any).electronAPI
    delete (window as any).electronAPI

    try {
      render(<RoxDesignPage />)

      expect(await screen.findByText(/bridge is not available/i)).toBeTruthy()
      expect(screen.getByRole('button', { name: /Повторить/i })).toBeTruthy()
    } finally {
      ;(window as any).electronAPI = previousApi
    }
  })
  it('shows a recoverable ROX-native error when runtime is missing', async () => {
    const { start } = installRoxDesignApi({
      status: 'failed',
      error: 'Rox Design runtime is not bundled yet.',
    })

    render(<RoxDesignPage />)

    expect(await screen.findByText('Rox Design')).toBeTruthy()
    expect(await screen.findByText(/runtime is not bundled/i)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: /Повторить/i }))
    await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  })

  it('hands the Rox Design web URL to the native Electron view instead of an iframe', async () => {
    const { show } = installRoxDesignApi({
      status: 'running',
      webUrl: 'https://rox-design-dev.t?embed=rox&theme=system&lang=ru',
      version: 'dev',
    })

    render(<RoxDesignPage />)

    expect(await screen.findByTestId('rox-design-native-host')).toBeTruthy()
    expect(screen.queryByTitle('Rox Design')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Rox Design' })).toBeNull()
    expect(screen.queryByText(/Встроенн/)).toBeNull()
    await waitFor(() => expect(show).toHaveBeenCalledTimes(1))
    const firstShowCall = show.mock.calls[0] as unknown[] | undefined
    expect(firstShowCall?.[0]).toMatchObject({
      url: 'https://rox-design-dev.t?embed=rox&theme=system&lang=ru',
    })
  })

  it('hides the native Rox Design view on unmount', async () => {
    const { hide, show } = installRoxDesignApi({
      status: 'running',
      webUrl: 'https://rox-design-dev.t?embed=rox&theme=system&lang=ru',
      version: 'dev',
    })

    const view = render(<RoxDesignPage />)

    await waitFor(() => expect(show).toHaveBeenCalledTimes(1))
    view.unmount()

    await waitFor(() => expect(hide).toHaveBeenCalledTimes(1))
  })
})
