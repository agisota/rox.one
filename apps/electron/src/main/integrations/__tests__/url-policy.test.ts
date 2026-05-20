/**
 * PZD-79 G.2.2.1.C — integration-agnostic URL allowlist + navigation primitives.
 *
 * Generalizes the trust-boundary helpers from PZD-65 (URL origin pinning,
 * audit finding A-H1). Tests port the original PZD-65 cases plus multi-origin
 * allowlist support.
 */
import { describe, expect, it } from 'bun:test'
import {
  decideNavigation,
  isUrlOriginAuthorized,
} from '../url-policy'

describe('isUrlOriginAuthorized', () => {
  it('allows a candidate whose origin matches the only allowlist entry', () => {
    expect(
      isUrlOriginAuthorized(['https://design.rox.one'], 'https://design.rox.one/projects/1'),
    ).toBe(true)
  })

  it('rejects a candidate served on a different port even if host matches', () => {
    expect(
      isUrlOriginAuthorized(['http://127.0.0.1:5173'], 'http://127.0.0.1:6000/x'),
    ).toBe(false)
  })

  it('rejects a candidate served on a different host even if scheme/port match', () => {
    expect(
      isUrlOriginAuthorized(['https://design.rox.one'], 'https://evil.example/'),
    ).toBe(false)
  })

  it('rejects a candidate served via a different scheme even if host matches', () => {
    expect(
      isUrlOriginAuthorized(['https://design.rox.one'], 'http://design.rox.one/'),
    ).toBe(false)
  })

  it('rejects non-http(s) candidates outright', () => {
    expect(isUrlOriginAuthorized(['https://design.rox.one'], 'file:///etc/passwd')).toBe(false)
    expect(isUrlOriginAuthorized(['https://design.rox.one'], 'data:text/html,<x>')).toBe(false)
  })

  it('rejects javascript: URLs even when the allowlist is permissive', () => {
    expect(
      isUrlOriginAuthorized(['https://design.rox.one'], 'javascript:alert(1)'),
    ).toBe(false)
  })

  it('rejects malformed candidate URLs', () => {
    expect(isUrlOriginAuthorized(['https://design.rox.one'], 'not a url')).toBe(false)
    expect(isUrlOriginAuthorized(['https://design.rox.one'], '')).toBe(false)
  })

  it('treats null/undefined allowlist (cast) as deny-all', () => {
    expect(
      isUrlOriginAuthorized(null as unknown as string[], 'https://design.rox.one/'),
    ).toBe(false)
    expect(
      isUrlOriginAuthorized(undefined as unknown as string[], 'https://design.rox.one/'),
    ).toBe(false)
  })

  it('returns false when the allowlist is empty', () => {
    expect(isUrlOriginAuthorized([], 'https://design.rox.one/')).toBe(false)
  })

  it('skips malformed allowlist entries but honors valid ones', () => {
    expect(
      isUrlOriginAuthorized(
        ['not a url', 'https://design.rox.one'],
        'https://design.rox.one/x',
      ),
    ).toBe(true)
  })

  it('accepts a candidate matching any entry in a multi-origin allowlist', () => {
    const allowlist = ['http://127.0.0.1:5173', 'https://design.rox.one']
    expect(isUrlOriginAuthorized(allowlist, 'http://127.0.0.1:5173/app')).toBe(true)
    expect(isUrlOriginAuthorized(allowlist, 'https://design.rox.one/foo')).toBe(true)
    expect(isUrlOriginAuthorized(allowlist, 'http://other.local/')).toBe(false)
  })
})

describe('decideNavigation', () => {
  const allowlist = ['https://design.rox.one']

  it('denies non-http(s) next URLs regardless of currentUrl', () => {
    expect(
      decideNavigation('https://design.rox.one/app', 'file:///tmp/nope', allowlist),
    ).toEqual({ action: 'deny' })
    expect(
      decideNavigation('https://design.rox.one/app', 'javascript:alert(1)', allowlist),
    ).toEqual({ action: 'deny' })
  })

  it('allows when currentUrl is null and next URL is in the allowlist', () => {
    expect(
      decideNavigation(null, 'https://design.rox.one/projects', allowlist),
    ).toEqual({ action: 'allow' })
  })

  it('denies when currentUrl is null and next URL is not in the allowlist', () => {
    expect(
      decideNavigation(null, 'https://evil.example/', allowlist),
    ).toEqual({ action: 'deny' })
  })

  it('allows same-origin navigation that is also within the allowlist', () => {
    expect(
      decideNavigation('https://design.rox.one/app', 'https://design.rox.one/projects/1', allowlist),
    ).toEqual({ action: 'allow' })
  })

  it('externalizes cross-origin http(s) navigation', () => {
    expect(
      decideNavigation('https://design.rox.one/app', 'https://example.com/', allowlist),
    ).toEqual({ action: 'external', url: 'https://example.com/' })
  })

  it('denies same-origin navigation that is NOT in the allowlist (defense in depth)', () => {
    expect(
      decideNavigation('https://evil.example/in', 'https://evil.example/out', allowlist),
    ).toEqual({ action: 'deny' })
  })

  it('denies when currentUrl is malformed', () => {
    expect(
      decideNavigation('not a url', 'https://design.rox.one/', allowlist),
    ).toEqual({ action: 'deny' })
  })

  it('supports multi-origin allowlist for cross-port primary surfaces', () => {
    const multi = ['http://127.0.0.1:5173', 'https://design.rox.one']
    expect(
      decideNavigation('http://127.0.0.1:5173/', 'http://127.0.0.1:5173/projects/1', multi),
    ).toEqual({ action: 'allow' })
    expect(
      decideNavigation('http://127.0.0.1:5173/', 'https://design.rox.one/', multi),
    ).toEqual({ action: 'external', url: 'https://design.rox.one/' })
  })
})
