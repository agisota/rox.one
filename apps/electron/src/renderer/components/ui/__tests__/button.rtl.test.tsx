import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, within } from '@testing-library/react'
import { render } from '../../../../test-utils/render'
import userEvent from '@testing-library/user-event'
import { expectNoA11yViolations } from '../../../../test-utils/a11y'
import { Button } from '../button'

// Cleanup after each test so rendered buttons don't bleed into subsequent queries.
afterEach(cleanup)

// Variants defined in this codebase's CVA config (button.tsx):
//   default, destructive, outline, secondary, ghost, link
// Sizes: default, sm, lg, icon
// No loading prop — Button is a thin CVA wrapper over <button> / Radix Slot.

describe('Button', () => {
  describe('variants', () => {
    it('renders the default variant with text content', () => {
      const { container } = render(<Button>Click me</Button>)
      const btn = within(container).getByRole('button')
      expect(btn.textContent).toBe('Click me')
    })

    it.each([
      ['default'],
      ['destructive'],
      ['outline'],
      ['secondary'],
      ['ghost'],
      ['link'],
    ] as const)('renders the %s variant without errors', (variant) => {
      const { container } = render(<Button variant={variant}>{variant}</Button>)
      expect(within(container).getByRole('button')).toBeTruthy()
    })
  })

  describe('sizes', () => {
    it.each([
      ['default'],
      ['sm'],
      ['lg'],
      ['icon'],
    ] as const)('renders the %s size without errors', (size) => {
      const { container } = render(<Button size={size}>{size}</Button>)
      expect(within(container).getByRole('button')).toBeTruthy()
    })
  })

  describe('disabled state', () => {
    it('sets disabled attribute when disabled prop is passed', () => {
      const { container } = render(<Button disabled>X</Button>)
      const btn = within(container).getByRole('button') as HTMLButtonElement
      expect(btn.hasAttribute('disabled')).toBe(true)
      expect(btn.disabled).toBe(true)
    })

    it('does not call onClick when disabled', async () => {
      const onClick = vi.fn()
      const user = userEvent.setup()
      const { container } = render(
        <Button disabled onClick={onClick}>X</Button>
      )
      await user.click(within(container).getByRole('button'))
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  describe('focus + click', () => {
    it('can be focused via Tab', async () => {
      const user = userEvent.setup()
      const { container } = render(<Button>X</Button>)
      const btn = within(container).getByRole('button')
      await user.tab()
      expect(document.activeElement).toBe(btn)
    })

    it('fires onClick on Enter when focused', async () => {
      const onClick = vi.fn()
      const user = userEvent.setup()
      const { container } = render(<Button onClick={onClick}>X</Button>)
      await user.tab()
      expect(document.activeElement).toBe(within(container).getByRole('button'))
      await user.keyboard('{Enter}')
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('fires onClick on Space when focused', async () => {
      const onClick = vi.fn()
      const user = userEvent.setup()
      const { container } = render(<Button onClick={onClick}>X</Button>)
      await user.tab()
      await user.keyboard(' ')
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('fires onClick on mouse click', async () => {
      const onClick = vi.fn()
      const user = userEvent.setup()
      const { container } = render(<Button onClick={onClick}>X</Button>)
      await user.click(within(container).getByRole('button'))
      expect(onClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('asChild prop', () => {
    it('renders as the child element when asChild is true', () => {
      const { container } = render(
        <Button asChild><a href="#">link-button</a></Button>
      )
      const anchor = container.querySelector('a')
      expect(anchor).toBeTruthy()
      expect(anchor?.textContent).toBe('link-button')
      // Should not render a <button> wrapper
      expect(container.querySelector('button')).toBeNull()
    })
  })

  describe('a11y', () => {
    it('has no a11y violations for a labeled button', async () => {
      const { container } = render(<Button>Save changes</Button>)
      await expectNoA11yViolations(container)
    })

    it('has no a11y violations for an icon-only button with aria-label', async () => {
      const { container } = render(
        <Button aria-label="Close" size="icon">×</Button>
      )
      await expectNoA11yViolations(container)
    })

    it('has no a11y violations for destructive variant', async () => {
      const { container } = render(
        <Button variant="destructive">Delete</Button>
      )
      await expectNoA11yViolations(container)
    })
  })
})
