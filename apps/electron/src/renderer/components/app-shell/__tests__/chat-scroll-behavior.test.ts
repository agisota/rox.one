import { describe, expect, it } from 'bun:test'

import { getResizeAutoScrollBehavior } from '../chat-scroll-behavior'

describe('chat resize auto-scroll behavior', () => {
  it('does not force an unfocused panel back to bottom after the user scrolled up', () => {
    expect(getResizeAutoScrollBehavior({ isFocusedPanel: false, isStickToBottom: false })).toBe('none')
  })

  it('keeps background panels following new output only while still stuck to bottom', () => {
    expect(getResizeAutoScrollBehavior({ isFocusedPanel: false, isStickToBottom: true })).toBe('instant')
  })

  it('keeps focused-panel smooth auto-follow gated by sticky bottom state', () => {
    expect(getResizeAutoScrollBehavior({ isFocusedPanel: true, isStickToBottom: true })).toBe('smooth')
    expect(getResizeAutoScrollBehavior({ isFocusedPanel: true, isStickToBottom: false })).toBe('none')
  })
})
