import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { ArenaBuilderScreen } from '../ArenaBuilderScreen';
import {
  createArenaBuilderState,
  createArenaBuilderStateFromTruth,
  createArenaDraftRun,
  toggleArenaAgentSelection,
} from '../arena-builder-state';
import type { ExperienceTruthState } from '@rox-one/shared/workbench';

describe('Arena Builder and Agent Collection', () => {
  test('renders agent roster, selected agents, swarm slots, and run estimate', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect', 'agent-skeptic'],
      entitlement: { maxSwarmSlots: 4 },
    });

    const markup = renderToStaticMarkup(<ArenaBuilderScreen initialState={state} />);

    expect(markup).toContain('Арена агентов');
    expect(markup).toContain('Коллекция агентов');
    expect(markup).toContain('Architect Prime');
    expect(markup).toContain('Skeptic Sentinel');
    expect(markup).toContain('Выбранные агенты');
    expect(markup).toContain('2 / 4 слота');
    expect(markup).toContain('Оценка бюджета');
  });

  test('locked agents cannot be selected', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-locked-redteam'],
      entitlement: { maxSwarmSlots: 4 },
    });

    expect(state.selectedAgentPackageIds).not.toContain('agent-locked-redteam');
    expect(state.selectionWarnings).toContain('Red Team Oracle is locked and cannot be selected.');

    const next = toggleArenaAgentSelection(state, 'agent-locked-redteam');
    expect(next.selectedAgentPackageIds).not.toContain('agent-locked-redteam');
    expect(next.selectionWarnings).toContain('Red Team Oracle is locked and cannot be selected.');
  });

  test('swarm count respects entitlement capacity without changing validation truth', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect', 'agent-skeptic', 'agent-researcher', 'agent-qa'],
      entitlement: { maxSwarmSlots: 2 },
    });

    expect(state.selectedAgentPackageIds).toEqual(['agent-architect', 'agent-skeptic']);
    expect(state.selectionWarnings).toContain('Swarm selection is capped at 2 slots by current entitlement.');
    expect(state.runEstimate.swarmSlotsUsed).toBe(2);
    expect(state.runEstimate.swarmSlotLimit).toBe(2);
    expect(state.runEstimate.validationGateIds).toEqual(['schema', 'logic_check', 'fact_check', 'security_check']);
  });

  test('budget estimate updates from selected agents', () => {
    const base = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect'],
      entitlement: { maxSwarmSlots: 4 },
    });
    const expanded = toggleArenaAgentSelection(base, 'agent-researcher');

    expect(base.runEstimate.budgetEstimateCredits).toBe(24);
    expect(expanded.runEstimate.budgetEstimateCredits).toBe(52);
    expect(expanded.runEstimate.estimatedContributionCount).toBe(26);
  });

  test('selected agents persist into draft run payload', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect', 'agent-qa'],
      entitlement: { maxSwarmSlots: 4 },
    });

    const draftRun = createArenaDraftRun(state);

    expect(draftRun.mode).toBe('swarm_arena');
    expect(draftRun.experienceLayer).toBe('arena');
    expect(draftRun.selectedAgentPackageIds).toEqual(['agent-architect', 'agent-qa']);
    expect(draftRun.budgetEstimateCredits).toBe(42);
    expect(draftRun.requiredGateIds).toEqual(['schema', 'logic_check', 'fact_check', 'security_check']);
  });

  test('installed runtime agents appear in arena roster and verified usage increases mastery', () => {
    const now = '2026-05-06T00:00:00.000Z';
    const truthState: ExperienceTruthState = {
      mission: {
        id: 'mission-arena-runtime',
        ownerUserId: 'user-one',
        teamId: 'team-alpha',
        workspaceId: 'workspace-main',
        mode: 'swarm_arena',
        experienceLayer: 'arena',
        title: 'Arena runtime draft',
        objective: 'Build a verified swarm draft.',
        durationHours: 24,
        checkpointCadenceHours: 6,
        status: 'draft',
        vdiTarget: 80,
        budgetCapCredits: 400,
        tokenCap: 500000,
        storageCapBytes: 1073741824,
        selectedAgentPackageIds: ['pkg-team-critic'],
        requiredGateIds: ['schema', 'logic_check', 'security_check'],
        createdAt: now,
      },
      checkpoints: [],
      gateResults: [],
      metricSnapshots: [],
      questProgress: [],
      agentPackages: [
        {
          id: 'pkg-team-critic',
          packageType: 'persona',
          name: 'Team Critic',
          description: 'Evidence-backed review agent.',
          ownerTeamId: 'team-alpha',
          visibility: 'team',
          rarity: 'rare',
          trustScore: 80,
          riskLevel: 'medium',
          permissionProfileId: 'permission-pkg-team-critic',
          latestVersion: '1.0.0',
          pricingModel: 'team_private',
          createdAt: now,
          updatedAt: now,
        },
      ],
      installedAgentPackageIds: ['pkg-team-critic'],
      ledger: [
        {
          id: 'ledger-pkg-team-critic-mastery',
          userId: 'user-one',
          teamId: 'team-alpha',
          eventType: 'unlock',
          amount: 12,
          currency: 'mastery',
          reason: 'Verified usage accepted for pkg-team-critic.',
          sourceArtifactId: 'artifact:pkg-team-critic:usage',
          validationGateResultId: 'gate:pkg-team-critic:verified-usage',
          createdAt: now,
        },
      ],
    };

    const state = createArenaBuilderStateFromTruth(truthState, { entitlement: { maxSwarmSlots: 3 } });
    const agent = state.roster.find((item) => item.package.id === 'pkg-team-critic');

    expect(agent?.package.name).toBe('Team Critic');
    expect(agent?.masteryPercent).toBe(92);
    expect(state.selectedAgentPackageIds).toEqual(['pkg-team-critic']);
    expect(createArenaDraftRun(state).selectedAgentPackageIds).toEqual(['pkg-team-critic']);
  });
});
