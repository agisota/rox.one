import { describe, expect, it } from 'bun:test';

import {
  createExperienceTruthState,
  projectExperienceTruthView,
} from '../experience-state';

const NOW = '2026-05-06T00:00:00.000Z';

describe('Experience truth-state binding', () => {
  it('projects Command, Game, and Arena from the same immutable truth model', () => {
    const truth = createExperienceTruthState({
      mission: {
        id: 'mission-real-state',
        ownerUserId: 'user-one',
        teamId: 'team-alpha',
        workspaceId: 'workspace-main',
        sourceArtifactId: 'artifact:brief',
        mode: 'swarm_arena',
        experienceLayer: 'command',
        title: 'Customer Due Diligence Deep Run',
        objective: 'Produce a verified diligence pack.',
        durationHours: 24,
        checkpointCadenceHours: 6,
        status: 'running',
        vdiTarget: 91,
        budgetCapCredits: 500,
        tokenCap: 1_000_000,
        storageCapBytes: 1_073_741_824,
        selectedAgentPackageIds: ['pkg-researcher'],
        requiredGateIds: ['schema', 'fact_check', 'security_check'],
        createdAt: NOW,
        startedAt: NOW,
      },
      checkpoints: [
        {
          id: 'cp-12h',
          missionRunId: 'mission-real-state',
          ordinal: 2,
          dueAt: NOW,
          title: 'Checkpoint 12h',
          summary: 'Fresh evidence memo produced.',
          artifactIds: ['artifact:evidence-memo'],
          vdiDelta: 6,
          status: 'running',
        },
      ],
      gateResults: [
        { gateId: 'schema', status: 'pass', evidenceRef: 'gate:schema:passed' },
        { gateId: 'fact_check', status: 'pass', evidenceRef: 'gate:fact:passed' },
        { gateId: 'security_check', status: 'warn', evidenceRef: 'gate:security:warn' },
      ],
      metricSnapshots: [
        {
          id: 'metric-real-state',
          missionRunId: 'mission-real-state',
          userId: 'user-one',
          teamId: 'team-alpha',
          qualityScore: 88,
          executionReadiness: 84,
          verifiedDeliverableIndex: 91,
          costEfficiency: 2,
          openRiskScore: 9,
          noiseScore: 4,
          evidenceRefs: ['artifact:evidence-memo', 'gate:fact:passed'],
          createdAt: NOW,
        },
      ],
      questProgress: [
        {
          id: 'progress-quest-formulate',
          questId: 'quest-formulate',
          userId: 'user-one',
          teamId: 'team-alpha',
          status: 'completed',
          percent: 100,
          evidenceRefs: ['artifact:brief'],
          completedAt: NOW,
        },
      ],
      ledger: [
        {
          id: 'ledger-real-xp',
          userId: 'user-one',
          teamId: 'team-alpha',
          eventType: 'xp',
          amount: 200,
          currency: 'xp',
          reason: 'Accepted verified mission artifact',
          sourceArtifactId: 'artifact:evidence-memo',
          createdAt: NOW,
        },
      ],
      agentPackages: [
        {
          id: 'pkg-researcher',
          packageType: 'persona',
          name: 'Trustworthy Researcher',
          description: 'Evidence-first research persona.',
          ownerTeamId: 'team-alpha',
          visibility: 'team',
          rarity: 'epic',
          trustScore: 94,
          riskLevel: 'low',
          permissionProfileId: 'permission-researcher',
          latestVersion: '1.0.0',
          pricingModel: 'team_private',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      installedAgentPackageIds: ['pkg-researcher'],
    });

    const command = projectExperienceTruthView(truth, 'command');
    const game = projectExperienceTruthView(truth, 'game');
    const arena = projectExperienceTruthView(truth, 'arena');

    expect(command.presentationLabel).toBe('Mission Control');
    expect(game.presentationLabel).toBe('Quest Run');
    expect(arena.presentationLabel).toBe('Arena Mission');

    for (const view of [command, game, arena]) {
      expect(view.truth.missionId).toBe('mission-real-state');
      expect(view.truth.checkpointIds).toEqual(['cp-12h']);
      expect(view.truth.requiredGateIds).toEqual(['schema', 'fact_check', 'security_check']);
      expect(view.truth.evidenceRefs).toEqual([
        'artifact:brief',
        'artifact:evidence-memo',
        'gate:fact:passed',
        'gate:schema:passed',
        'gate:security:warn',
      ]);
      expect(view.truth.validationSemanticsMutable).toBe(false);
      expect(view.truth.ledgerSemanticsMutable).toBe(false);
    }
  });

  it('rejects checkpoint truth that belongs to a different mission', () => {
    expect(() =>
      createExperienceTruthState({
        mission: {
          id: 'mission-one',
          ownerUserId: 'user-one',
          workspaceId: 'workspace-main',
          mode: 'deep_run',
          experienceLayer: 'command',
          title: 'Mission one',
          objective: 'Verify state boundaries.',
          durationHours: 24,
          checkpointCadenceHours: 6,
          status: 'running',
          vdiTarget: 80,
          budgetCapCredits: 100,
          tokenCap: 1000,
          storageCapBytes: 1000,
          selectedAgentPackageIds: [],
          requiredGateIds: ['schema'],
          createdAt: NOW,
        },
        checkpoints: [
          {
            id: 'cp-other',
            missionRunId: 'mission-two',
            ordinal: 1,
            dueAt: NOW,
            title: 'Other mission checkpoint',
            summary: '',
            artifactIds: [],
            vdiDelta: 0,
            status: 'queued',
          },
        ],
      }),
    ).toThrow('Experience truth checkpoints must belong to the mission');
  });
});
