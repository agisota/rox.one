import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { render } from '../../../../../test-utils/render'
import { ProductModeToolbar } from '../ProductModeToolbar'

afterEach(cleanup)

describe('ProductModeToolbar compact actions', () => {
  it('keeps secondary actions in an overflow menu while preserving their intent payloads', async () => {
    const user = userEvent.setup()
    const onIntent = vi.fn()

    const { container } = render(
      <ProductModeToolbar
        selectedMode="research"
        onModeChange={() => undefined}
        onIntent={onIntent}
      />,
    )

    expect(container.querySelectorAll('[data-product-mode-action]')).toHaveLength(3)

    await user.click(screen.getByTestId('product-mode-action-overflow'))

    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3)

    await user.click(within(menu).getByRole('menuitem', { name: /workbench\.actions\.buildSpec/ }))

    expect(onIntent).toHaveBeenCalledWith({
      type: 'product-mode-intent',
      source: 'composer-toolbar',
      actionId: 'build-spec',
      mode: 'spec',
      labelKey: 'workbench.actions.buildSpec',
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('emits primary action intents without opening the overflow menu', async () => {
    const user = userEvent.setup()
    const onIntent = vi.fn()

    render(
      <ProductModeToolbar
        selectedMode="review"
        onModeChange={() => undefined}
        onIntent={onIntent}
      />,
    )

    await user.click(screen.getByRole('button', { name: /workbench\.actions\.verify/ }))

    expect(onIntent).toHaveBeenCalledWith({
      type: 'product-mode-intent',
      source: 'composer-toolbar',
      actionId: 'verify',
      mode: 'verify',
      labelKey: 'workbench.actions.verify',
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
