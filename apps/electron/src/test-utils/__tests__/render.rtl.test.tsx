import { describe, it, expect } from 'vitest'
import { render } from '../render'

describe('TestComposerHarness smoke', () => {
  it('renders a child element through the harness', () => {
    const { getByText } = render(<div>hello</div>)
    expect(getByText('hello')).toBeTruthy()
  })
})
