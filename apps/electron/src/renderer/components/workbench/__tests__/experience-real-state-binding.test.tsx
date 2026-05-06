import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { createExperienceTruthState } from '@rox-agent/shared/workbench';

import { AgentForgeTeamRegistry } from '../AgentForgeTeamRegistry';
import { ArenaBuilderScreen } from '../ArenaBuilderScreen';
import { DeepMissionsScreen } from '../DeepMissionsScreen';
import { MissionControlRunDetail } from '../MissionControlRunDetail';
import { ProgressionObservatory } from '../ProgressionObservatory';
import { QuestMapSkillTree } from '../QuestMapSkillTree';

const NOW = '2026-05-06T00:00:00.000Z';

function createRealStateFixture() {
  return createExperienceTruthState({
    mission: {
      id: 'mission-real-state',
      ownerUserId: 'user-one',
      teamId: 'team-alpha',
      workspaceId: 'workspace-main',
      sourceArtifactId: 'artifact:brief',
      mode: 'swarm_arena',
      experienceLayer: 'arena',
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
        id: 'progress-quest-frame-raw-prompt',
        questId: 'quest-frame-raw-prompt',
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
}

describe('Experience screens real-state binding', () => {
  test('Mission Control renders mission and checkpoint data from shared truth state', () => {
    const markup = renderToStaticMarkup(<MissionControlRunDetail truthState={createRealStateFixture()} />);

    expect(markup).toContain('Customer Due Diligence Deep Run');
    expect(markup).toContain('Чекпоинт 12h');
    expect(markup).toContain('В работе');
    expect(markup).toContain('artifact:evidence-memo');
  });

  test('Progression Observatory reads metric snapshots and ledger evidence from shared truth state', () => {
    const markup = renderToStaticMarkup(<ProgressionObservatory truthState={createRealStateFixture()} />);

    expect(markup).toContain('91');
    expect(markup).toContain('88');
    expect(markup).toContain('84');
    expect(markup).toContain('200 xp');
  });

  test('Quest Map keeps quest progress stable across Command, Game, and Arena copy', () => {
    const truthState = createRealStateFixture();
    const commandMarkup = renderToStaticMarkup(<QuestMapSkillTree truthState={truthState} layer="command" />);
    const gameMarkup = renderToStaticMarkup(<QuestMapSkillTree truthState={truthState} layer="game" />);
    const arenaMarkup = renderToStaticMarkup(<QuestMapSkillTree truthState={truthState} layer="arena" />);

    expect(commandMarkup).toContain('Карта задач');
    expect(gameMarkup).toContain('Карта квестов');
    expect(arenaMarkup).toContain('Кампания арены');
    for (const markup of [commandMarkup, gameMarkup, arenaMarkup]) {
      expect(markup).toContain('Оформить сырой prompt');
      expect(markup).toContain('Готово');
    }
  });

  test('Agent Forge, Arena Builder, and Deep Missions can derive initial state from shared truth', () => {
    const truthState = createRealStateFixture();
    const forgeMarkup = renderToStaticMarkup(<AgentForgeTeamRegistry truthState={truthState} />);
    const arenaMarkup = renderToStaticMarkup(<ArenaBuilderScreen truthState={truthState} />);
    const deepMissionMarkup = renderToStaticMarkup(<DeepMissionsScreen truthState={truthState} />);

    expect(forgeMarkup).toContain('Trustworthy Researcher');
    expect(arenaMarkup).toContain('Trustworthy Researcher');
    expect(deepMissionMarkup).toContain('Customer Due Diligence Deep Run');
    expect(deepMissionMarkup).toContain('91');
  });
});
