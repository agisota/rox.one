import { describe, expect, it } from 'vitest'

import { getPathBasename } from '../platform'

describe('getPathBasename', () => {
  it('returns the final segment from Unix-style paths regardless of renderer platform', () => {
    expect(getPathBasename('/home/test/my-project')).toBe('my-project')
    expect(getPathBasename('/home/test/my-project/')).toBe('my-project')
  })

  it('returns the final segment from Windows-style paths regardless of renderer platform', () => {
    expect(getPathBasename('C:\\Users\\test\\my-project')).toBe('my-project')
    expect(getPathBasename('C:\\Users\\test\\my-project\\')).toBe('my-project')
  })
})
