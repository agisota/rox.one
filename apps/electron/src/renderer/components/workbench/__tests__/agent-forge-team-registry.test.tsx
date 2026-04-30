import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AgentForgeTeamRegistry } from '../AgentForgeTeamRegistry';
import {
  calculateForgeTrustScore,
  createAgentForgeState,
  installAgentPackage,
  listVisibleAgentPackages,
  publishAgentPackage,
} from '../agent-forge-state';

describe('Agent Forge and Team Registry', () => {
  test('package without contract cannot install', () => {
    const state = createAgentForgeState();

    expect(() => installAgentPackage(state, 'pkg-no-contract')).toThrow(
      'Agent package cannot install without a skill contract.',
    );
  });

  test('trust score requires reviews and tests', () => {
    expect(calculateForgeTrustScore({ reviewCount: 0, passingTestCount: 4, promptInjectionWarnings: [] })).toBe(0);
    expect(calculateForgeTrustScore({ reviewCount: 2, passingTestCount: 0, promptInjectionWarnings: [] })).toBe(0);
    expect(calculateForgeTrustScore({ reviewCount: 2, passingTestCount: 4, promptInjectionWarnings: [] })).toBe(80);
  });

  test('prompt injection warning blocks public publish', () => {
    const state = createAgentForgeState();

    expect(() => publishAgentPackage(state, 'pkg-injection-risk', 'public')).toThrow(
      'Prompt injection warnings block public publish.',
    );
  });

  test('team-private package is not visible cross-tenant', () => {
    const state = createAgentForgeState();

    expect(listVisibleAgentPackages(state, { viewerTeamId: 'team-alpha' }).map((pkg) => pkg.id)).toContain('pkg-team-critic');
    expect(listVisibleAgentPackages(state, { viewerTeamId: 'team-beta' }).map((pkg) => pkg.id)).not.toContain('pkg-team-critic');
  });

  test('renders private/team registry, package contracts, install, fork, and forge gauntlet', () => {
    const state = createAgentForgeState();
    const markup = renderToStaticMarkup(<AgentForgeTeamRegistry initialState={state} />);

    expect(markup).toContain('Кузница агентов');
    expect(markup).toContain('Приватные и командные пакеты');
    expect(markup).toContain('Контракт');
    expect(markup).toContain('Установить');
    expect(markup).toContain('Форкнуть');
    expect(markup).toContain('Проверочный гаунтлет');
  });
});
