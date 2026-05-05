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
      'Prompt injection warnings block public package publish.',
    );
  });

  test('public publish requires contract, reviews, tests, and trust evidence', () => {
    const state = createAgentForgeState();

    expect(() => publishAgentPackage(state, 'pkg-no-contract', 'public')).toThrow(
      'Public package publish requires a skill contract.',
    );
    expect(() =>
      publishAgentPackage(
        createAgentForgeState({
          reviewsByPackageId: { 'pkg-team-critic': 0 },
        }),
        'pkg-team-critic',
        'public',
      ),
    ).toThrow('Public package publish requires reviewer evidence.');
    expect(() =>
      publishAgentPackage(
        createAgentForgeState({
          testsByPackageId: { 'pkg-team-critic': 0 },
        }),
        'pkg-team-critic',
        'public',
      ),
    ).toThrow('Public package publish requires passing test evidence.');
    expect(() =>
      publishAgentPackage(
        createAgentForgeState({
          packages: createAgentForgeState().packages.map((pkg) =>
            pkg.id === 'pkg-team-critic' ? { ...pkg, trustScore: 49 } : pkg,
          ),
        }),
        'pkg-team-critic',
        'public',
      ),
    ).toThrow('Public package publish requires trust score >= 50.');
  });

  test('team-private package is not visible cross-tenant', () => {
    const state = createAgentForgeState();

    expect(listVisibleAgentPackages(state, { viewerTeamId: 'team-alpha' }).map((pkg) => pkg.id)).toContain('pkg-team-critic');
    expect(listVisibleAgentPackages(state, { viewerTeamId: 'team-beta' }).map((pkg) => pkg.id)).not.toContain('pkg-team-critic');
  });

  test('user-private package is visible only to its owner, not every team member', () => {
    const base = createAgentForgeState();
    const state = createAgentForgeState({
      packages: base.packages.concat({
        ...base.packages[0]!,
        id: 'pkg-private-owner',
        name: 'Private Owner Pack',
        visibility: 'private',
        ownerUserId: 'user-owner',
        ownerTeamId: 'team-alpha',
      }),
    });

    expect(
      listVisibleAgentPackages(state, { viewerTeamId: 'team-alpha', viewerUserId: 'user-other' }).map((pkg) => pkg.id),
    ).not.toContain('pkg-private-owner');
    expect(
      listVisibleAgentPackages(state, { viewerTeamId: 'team-alpha', viewerUserId: 'user-owner' }).map((pkg) => pkg.id),
    ).toContain('pkg-private-owner');
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
