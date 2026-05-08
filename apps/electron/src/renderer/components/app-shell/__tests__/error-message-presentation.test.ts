import { describe, expect, it } from 'bun:test'
import type { Message } from '../../../../shared/types'
import { createErrorMessagePresentation } from '../error-message-presentation'

const t = (key: string) => ({
  'errors.piRuntimeNotConfigured.message': 'PI runtime is not configured. Choose another model connection or configure the PI runtime in Settings.',
  'errors.piRuntimeNotConfigured.settingsAction': 'Open settings',
  'errors.piRuntimeNotConfigured.title': 'PI runtime not configured',
}[key] ?? key)

describe('createErrorMessagePresentation', () => {
  it('maps raw PI subprocess path errors to a user-facing settings recovery', () => {
    const message: Message = {
      id: 'error-1',
      role: 'error',
      content: 'piServerPath not configured. Cannot spawn Pi subprocess.',
      timestamp: 1,
    }

    const presentation = createErrorMessagePresentation(message, t)

    expect(presentation.title).toBe('PI runtime not configured')
    expect(presentation.content).toContain('Choose another model connection')
    expect(presentation.details).toEqual([
      'Raw error: piServerPath not configured. Cannot spawn Pi subprocess.',
    ])
    expect(presentation.actions).toContainEqual({
      key: 'pi-runtime-settings',
      label: 'Open settings',
      action: 'settings',
    })
  })

  it('preserves existing settings action when PI error payload already provides one', () => {
    const message: Message = {
      id: 'error-2',
      role: 'error',
      content: 'Runtime failed',
      timestamp: 1,
      errorDetails: ['piServerPath not configured. Cannot spawn Pi subprocess.'],
      errorActions: [{ key: 'settings', label: 'Settings', action: 'settings' }],
    }

    const presentation = createErrorMessagePresentation(message, t)

    expect(presentation.actions).toEqual([{ key: 'settings', label: 'Settings', action: 'settings' }])
  })
})
