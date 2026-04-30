import { describe, expect, it } from 'bun:test';
import {
  generateTddTaskPack,
  renderTddTaskPackMarkdown,
} from '../tdd-task-generator';

describe('TDD task generator', () => {
  it('generates a deterministic red-green-verify task pack with red tests first', () => {
    const pack = generateTddTaskPack({
      ticketId: 'T031',
      title: 'TDD mode task generation',
      rawInput: 'Generate implementation tasks for TDD mode.',
      modeId: 'tdd',
      validationGates: ['unit_tests', 'integration_tests', 'e2e_tests'],
      touchedSurfaces: ['shared/workbench', 'external:browser'],
      createdAt: '2026-04-30T15:00:00.000Z',
    });

    expect(pack.packId).toBe('tdd-pack-T031-2026-04-30T15-00-00-000Z');
    expect(pack.tasks.map((task) => task.id)).toEqual([
      'T031-RED',
      'T031-GREEN',
      'T031-VERIFY',
      'T031-WORKLOG',
    ]);
    expect(pack.tasks[0]!.phase).toBe('red');
    expect(pack.tasks[0]!.mustRunBefore).toEqual(['T031-GREEN']);
    expect(pack.tasks[1]!.dependsOn).toEqual(['T031-RED']);
    expect(pack.tasks[0]!.checkCommands).toEqual([
      'bun test <unit-test-file>',
      'bun test <integration-test-file>',
      'bun test <e2e-or-smoke-test-file>',
    ]);
    expect(pack.fakeProviderRequirements).toEqual([
      'Use fake browser/research providers; no real browser, search, or network calls in tests.',
    ]);
  });

  it('adds security, RBAC, quota, and sync gate check commands when requested', () => {
    const pack = generateTddTaskPack({
      ticketId: 'T038',
      title: 'Security hardening pass',
      rawInput: 'Harden auth, teams, storage, and sync boundaries.',
      modeId: 'verify',
      validationGates: ['security_check', 'rbac_check', 'quota_check', 'sync_check'],
      touchedSurfaces: ['auth', 'team', 'storage', 'sync'],
      createdAt: '2026-04-30T16:00:00.000Z',
    });

    expect(pack.tasks[0]!.checkCommands).toEqual([
      'bun test <security-test-file>',
      'bun test <rbac-role-matrix-test-file>',
      'bun test <quota-test-file>',
      'bun test <sync-conflict-test-file>',
    ]);
    expect(pack.fakeProviderRequirements).toEqual([
      'Use fake auth/session providers; no production auth or credential mutation in tests.',
      'Use fake team/RBAC stores; no real invites or external identity calls in tests.',
      'Use fake S3/storage adapters; no real object-store calls in tests.',
      'Use fake sync remotes; no real cloud workspace writes in tests.',
    ]);
  });

  it('renders a markdown checklist without claiming tests have passed', () => {
    const pack = generateTddTaskPack({
      ticketId: 'T031',
      title: 'TDD mode task generation',
      rawInput: 'Generate implementation tasks for TDD mode.',
      modeId: 'tdd',
      validationGates: ['unit_tests'],
      touchedSurfaces: ['shared/workbench'],
      createdAt: '2026-04-30T15:00:00.000Z',
    });

    expect(renderTddTaskPackMarkdown(pack)).toContain('# TDD Task Pack - T031 TDD mode task generation');
    expect(renderTddTaskPackMarkdown(pack)).toContain('## T031-RED - Write failing tests first');
    expect(renderTddTaskPackMarkdown(pack)).toContain('- [ ] Run `bun test <unit-test-file>` and confirm expected failure.');
    expect(renderTddTaskPackMarkdown(pack)).toContain('Status: planned');
  });
});
