import { describe, it, expect } from 'vitest'
import { render } from '../render'
import { useModalRegistry } from '@/context/ModalContext'

function ModalRegistryProbe() {
  const registry = useModalRegistry()
  return (
    <div>
      <span data-testid="has-open-modals">{String(registry.hasOpenModals())}</span>
      <span data-testid="close-top-modal">{String(registry.closeTopModal())}</span>
    </div>
  )
}

describe('TestComposerHarness smoke', () => {
  it('renders a child element through the harness', () => {
    const { getByText } = render(<div>hello</div>)
    expect(getByText('hello')).toBeTruthy()
  })

  it('provides the modal registry used by dialog components', () => {
    const { getByTestId } = render(<ModalRegistryProbe />)
    expect(getByTestId('has-open-modals').textContent).toBe('false')
    expect(getByTestId('close-top-modal').textContent).toBe('false')
  })
})
