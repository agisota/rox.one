import { describe, expect, it } from 'bun:test'

import { PiAgent } from '../pi-agent.ts'
import {
  resolvePiProviderDependencyRiskMode,
  resolvePiProviderDependencyRiskModeForHost,
} from '../dependency-risk.ts'
import { createMockBackendConfig } from './test-utils.ts'

describe('PI provider dependency risk mode', () => {
  it('defaults to public-untrusted when a public app URL is configured', () => {
    expect(
      resolvePiProviderDependencyRiskMode({
        CRAFT_PUBLIC_APP_URL: 'https://rox.one',
      }),
    ).toBe('public-untrusted')
  })

  it('lets the PI-specific risk mode override the generic provider mode', () => {
    expect(
      resolvePiProviderDependencyRiskMode({
        CRAFT_PUBLIC_APP_URL: 'https://rox.one',
        CRAFT_PROVIDER_DEPENDENCY_RISK_MODE: 'accepted-risk',
        CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE: 'public-untrusted',
      }),
    ).toBe('public-untrusted')
  })

  it('treats Electron desktop resources as private-local even when public app URL is set', () => {
    expect(
      resolvePiProviderDependencyRiskModeForHost(
        {
          appRootPath: '/Applications/ROX.ONE.app/Contents/Resources/app',
          resourcesPath: '/Applications/ROX.ONE.app/Contents/Resources',
        },
        {
          CRAFT_PUBLIC_APP_URL: 'https://rox.one',
        },
      ),
    ).toBe('private-local')
  })

  it('rejects public-untrusted startup before resolving subprocess path or credentials', async () => {
    const agent = new PiAgent(createMockBackendConfig({
      provider: 'pi',
      runtime: {
        dependencyRiskMode: 'public-untrusted',
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
        CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE: 'accepted-risk',
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
