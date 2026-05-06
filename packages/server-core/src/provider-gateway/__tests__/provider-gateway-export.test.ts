import { describe, expect, it } from 'bun:test'

import {
  createFakeProviderGateway,
  createProviderGateway,
  ProviderGatewayError,
} from '@craft-agent/server-core/provider-gateway'

describe('provider gateway package export', () => {
  it('exposes provider orchestration contracts through server-core', () => {
    expect(createFakeProviderGateway).toBeTypeOf('function')
    expect(createProviderGateway).toBeTypeOf('function')
    expect(ProviderGatewayError).toBeTypeOf('function')
  })
})
