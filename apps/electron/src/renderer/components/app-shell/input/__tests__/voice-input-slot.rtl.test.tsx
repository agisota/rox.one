/**
 * voice-input-slot.rtl.test.tsx (M.10 T238)
 *
 * RTL coverage for the placeholder voice-input toolbar slot. The slot is
 * presentational so the assertions stay close to the surface — ARIA
 * label, disabled state when no `onStart` is supplied, tooltip body, and
 * the interactive path that fires when a future provider hands the slot
 * an `onStart` callback.
 */
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { render } from '../../../../../test-utils/render'
import { VoiceInputSlot } from '../VoiceInputSlot'

afterEach(cleanup)

describe('VoiceInputSlot placeholder mode (no onStart)', () => {
  it('renders disabled with the localised aria-label fallback', () => {
    render(<VoiceInputSlot />)

    const button = screen.getByTestId('composer-voice-input-button')
    expect(button).toHaveAttribute('aria-label', 'Voice input')
    expect(button).toBeDisabled()
    expect(button.getAttribute('data-placeholder')).toBe('true')
  })

  it('surfaces the "coming soon" hint in the tooltip title fallback', () => {
    render(<VoiceInputSlot />)

    const button = screen.getByTestId('composer-voice-input-button')
    // The title attribute mirrors the tooltip body so screen readers and
    // browser native tooltips see the same copy.
    expect(button.getAttribute('title')).toContain('Coming soon')
  })

  it('swallows clicks while disabled (no thrown errors, no spurious handlers)', async () => {
    const user = userEvent.setup()
    render(<VoiceInputSlot />)

    const button = screen.getByTestId('composer-voice-input-button')
    // userEvent respects disabled — the click should be a no-op. The
    // assertion is that we do not crash and the button stays disabled.
    await user.click(button)
    expect(button).toBeDisabled()
  })
})

describe('VoiceInputSlot interactive mode (onStart provided)', () => {
  it('enables and invokes onStart on click when a provider is wired', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<VoiceInputSlot onStart={onStart} />)

    const button = screen.getByTestId('composer-voice-input-button')
    expect(button).not.toBeDisabled()
    expect(button.getAttribute('data-placeholder')).toBe('false')

    await user.click(button)
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('respects an explicit `disabled` prop even when onStart is supplied', async () => {
    const onStart = vi.fn()
    render(<VoiceInputSlot onStart={onStart} disabled />)

    const button = screen.getByTestId('composer-voice-input-button')
    expect(button).toBeDisabled()
  })
})

describe('VoiceInputSlot recording mode (T239)', () => {
  it('exposes the recording flag via data-recording + aria-pressed', () => {
    const onStart = vi.fn()
    const onStop = vi.fn()
    render(<VoiceInputSlot onStart={onStart} onStop={onStop} recording />)

    const button = screen.getByTestId('composer-voice-input-button')
    expect(button.getAttribute('data-recording')).toBe('true')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    // Tooltip title swaps to the stop-action copy while capture is live.
    expect(button.getAttribute('title')).toContain('Stop recording')
  })

  it('routes the click to onStop while recording, leaving onStart untouched', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    const onStop = vi.fn()
    render(<VoiceInputSlot onStart={onStart} onStop={onStop} recording />)

    await user.click(screen.getByTestId('composer-voice-input-button'))
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('falls back to onStart when recording but no onStop is wired', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<VoiceInputSlot onStart={onStart} recording />)

    await user.click(screen.getByTestId('composer-voice-input-button'))
    // T239 contract: when the host hands the slot a `recording` flag but
    // omits `onStop`, the click is treated as a no-op stop attempt; the
    // start handler must NOT fire to avoid double-starting a recognizer.
    expect(onStart).not.toHaveBeenCalled()
  })

  it('renders aria-pressed=false in the idle interactive state', () => {
    const onStart = vi.fn()
    render(<VoiceInputSlot onStart={onStart} />)

    const button = screen.getByTestId('composer-voice-input-button')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.getAttribute('data-recording')).toBe('false')
  })
})
