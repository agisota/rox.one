import { describe, expect, it } from 'bun:test'

import { PiAgent } from '../pi-agent.ts'
import {
  resolvePiProviderDependencyRiskMode,
} from '../dependency-risk.ts'
import { createMockBackendConfig } from './test-utils.ts'

describe('PI provider dependency risk mode', () => {
  it('defaults to public-untrusted when a public app URL is configured', () => {
    expect(
      resolvePiProviderDependencyRiskMode({
        ROX_PUBLIC_APP_URL: 'https://rox.one',
      }),
    ).toBe('public-untrusted')
  })

  it('lets the PI-specific risk mode override the generic provider mode', () => {
    expect(
      resolvePiProviderDependencyRiskMode({
        ROX_PUBLIC_APP_URL: 'https://rox.one',
        ROX_PROVIDER_DEPENDENCY_RISK_MODE: 'accepted-risk',
        ROX_PI_PROVIDER_DEPENDENCY_RISK_MODE: 'public-untrusted',
      }),
    ).toBe('public-untrusted')
  })

  it('rejects public-untrusted startup before resolving subprocess path or credentials', async () => {
    const agent = new PiAgent(createMockBackendConfig({
      provider: 'pi',
      envOverrides: {
        ROX_PI_PROVIDER_DEPENDENCY_RISK_MODE: 'public-untrusted',
      },
    }))

    try {
      await expect((agent as any).spawnSubprocess()).rejects.toThrow(
        'PI provider runtime is disabled for public untrusted exposure',
      )
    } finally {
      agent.destroy()
    }
  })

  it('preserves accepted-risk startup behavior and reaches the existing path check', async () => {
    const agent = new PiAgent(createMockBackendConfig({
      provider: 'pi',
      envOverrides: {
        ROX_PI_PROVIDER_DEPENDENCY_RISK_MODE: 'accepted-risk',
      },
    }))

    try {
      await expect((agent as any).spawnSubprocess()).rejects.toThrow(
        'piServerPath not configured',
      )
    } finally {
      agent.destroy()
    }
  })
})
