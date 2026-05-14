import * as React from 'react'
import { describe, it, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { render } from '../../../../test-utils/render'
import { expectNoA11yViolations } from '../../../../test-utils/a11y'

// Cleanup after each test so rendered elements don't bleed into subsequent queries.
afterEach(cleanup)

describe('Color Contrast (muted-foreground)', () => {
  describe('WCAG 1.4.3 contrast audit', () => {
    it('muted-foreground text on background in light mode passes color-contrast', async () => {
      const { container } = render(
        <div className="bg-background text-muted-foreground">
          This text uses muted-foreground color in light mode
        </div>,
      )
      await expectNoA11yViolations(container, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
      })
    })

    it('muted-foreground text on background in dark mode passes color-contrast', async () => {
      const { container } = render(
        <div className="dark bg-background text-muted-foreground">
          This text uses muted-foreground color in dark mode
        </div>,
      )
      await expectNoA11yViolations(container, {
        runOnly: { type: 'rule', values: ['color-contrast'] },
      })
    })
  })
})
