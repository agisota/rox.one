import { describe, expect, it } from 'bun:test';

import {
  createExperienceRuntimeStore,
  EXPERIENCE_QUEST_GRAPH,
  createInMemoryExperiencePersistenceAdapter,
  createInitialExperienceRuntimeState,
  replayExperienceEvents,
  selectActiveExperienceTruthState,
  selectExperienceRuntimeProjection,
  type ExperienceEvent,
} from '../experience-runtime-store';
import type { AgentPackage } from '../experience-layer';

const NOW = '2026-05-06T00:00:00.000Z';

function event(
  id: string,
  type: ExperienceEvent['type'],
  payload: Record<string, unknown>,
): ExperienceEvent {
  return {
    id,
    type,
    createdAt: NOW,
    actorId: 'user-one',
    payload,
  } as ExperienceEvent;
}

function missionLaunchedEvent(id = 'evt-mission-launched'): ExperienceEvent {
  return event(id, 'mission.launched', {
    mission: {
      id: 'mission-runtime',
      ownerUserId: 'user-one',
      teamId: 'team-alpha',
      workspaceId: 'workspace-main',
      sourceArtifactId: 'artifact:brief',
      mode: 'deep_run',
      experienceLayer: 'command',
      title: 'Runtime truth mission',
      objective: 'Produce a verified release candidate.',
      durationHours: 24,
      checkpointCadenceHours: 6,
      status: 'running',
      vdiTarget: 90,
      budgetCapCredits: 500,
      tokenCap: 1_000_000,
      storageCapBytes: 1_073_741_824,
      selectedAgentPackageIds: ['pkg-qa'],
      requiredGateIds: ['schema', 'fact_check', 'security_check'],
      createdAt: NOW,
      startedAt: NOW,
    },
    checkpoints: [
      {
        id: 'cp-6h',
        missionRunId: 'mission-runtime',
        ordinal: 1,
        dueAt: NOW,
        title: 'Checkpoint 6h',
        summary: 'Waiting for first evidence.',
        artifactIds: [],
        vdiDelta: 0,
        status: 'queued',
      },
    ],
  });
}

function agentPackage(input: Partial<AgentPackage> = {}): AgentPackage {
  return {
    id: input.id ?? 'pkg-team-critic',
    packageType: input.packageType ?? 'persona',
    name: input.name ?? 'Team Critic',
    description: input.description ?? 'Evidence-backed review agent.',
    ownerTeamId: input.ownerTeamId ?? 'team-alpha',
    visibility: input.visibility ?? 'team',
    rarity: input.rarity ?? 'rare',
    trustScore: input.trustScore ?? 80,
    riskLevel: input.riskLevel ?? 'medium',
    permissionProfileId: input.permissionProfileId ?? 'permission-pkg-team-critic',
    latestVersion: input.latestVersion ?? '1.0.0',
    pricingModel: input.pricingModel ?? 'team_private',
    createdAt: input.createdAt ?? NOW,
    updatedAt: input.updatedAt ?? NOW,
  };
}

describe('ExperienceRuntimeStore', () => {
  it('ships the required ROX quest graph and advances it from runtime events deterministically', () => {
    expect(EXPERIENCE_QUEST_GRAPH.map((quest) => quest.title)).toEqual([
      'Frame raw prompt',
      'Rewrite prompt',
      'Clarify assumptions',
      'Build executable spec',
      'Generate TDD plan',
      'Run Review Gate',
      'Launch first deep mission',
      'Complete checkpoint with evidence',
      'Resolve blocker',
      'Final verified deliverable',
      'Launch swarm arena',
      'Install trusted agent package',
      'Fork package into team registry',
      'Share verified session',
    ]);

    const events: ExperienceEvent[] = [
      event('evt-prompt-submitted', 'prompt.submitted', {
        artifactId: 'artifact:brief',
        rawPrompt: 'Ship the RC with evidence.',
      }),
      event('evt-prompt-rewritten', 'prompt.rewritten', {
        artifactId: 'artifact:rewritten-prompt',
        sourceArtifactId: 'artifact:brief',
        rewrittenPrompt: 'Build a release candidate with validation evidence.',
      }),
      event('evt-spec-compiled', 'spec.compiled', {
        artifactId: 'artifact:spec',
        sourceArtifactId: 'artifact:rewritten-prompt',
        title: 'RC spec',
      }),
      event('evt-tdd-plan-created', 'tdd.plan.created', {
        artifactId: 'artifact:tdd-plan',
        sourceArtifactId: 'artifact:spec',
      }),
      event('evt-review-completed', 'review.completed', {
        artifactId: 'artifact:review-report',
        gateEvidenceRefs: ['gate:review:warned'],
        findingCount: 1,
      }),
      missionLaunchedEvent(),
      event('evt-artifact-created', 'artifact.created', {
        artifact: {
          id: 'artifact:checkpoint-evidence',
          missionRunId: 'mission-runtime',
          checkpointId: 'cp-6h',
          artifactType: 'report',
          title: 'Checkpoint evidence',
          evidenceRefs: ['gate:schema:passed'],
          createdAt: NOW,
        },
      }),
      event('evt-gate-passed', 'gate.passed', {
        missionRunId: 'mission-runtime',
        gateId: 'schema',
        evidenceRef: 'gate:schema:passed',
      }),
      event('evt-checkpoint-completed', 'mission.checkpoint.completed', {
        missionRunId: 'mission-runtime',
        checkpointId: 'cp-6h',
        summary: 'Checkpoint evidence accepted.',
        artifactIds: ['artifact:checkpoint-evidence'],
        vdiDelta: 6,
      }),
      event('evt-finalized', 'mission.finalized', {
        missionRunId: 'mission-runtime',
        finalArtifactId: 'artifact:checkpoint-evidence',
        gateEvidenceRefs: ['gate:schema:passed'],
      }),
    ];

    const reduced = replayExperienceEvents(events);
    const replayed = replayExperienceEvents(events);
    const completedQuestIds = reduced.questProgress
      .filter((progress) => progress.status === 'completed')
      .map((progress) => progress.questId);

    expect(replayed.questProgress).toEqual(reduced.questProgress);
    expect(completedQuestIds).toEqual([
      'quest-frame-raw-prompt',
      'quest-rewrite-prompt',
      'quest-build-executable-spec',
      'quest-generate-tdd-plan',
      'quest-run-review-gate',
      'quest-launch-first-deep-mission',
      'quest-complete-checkpoint-with-evidence',
      'quest-final-verified-deliverable',
    ]);
    expect(reduced.metricSnapshots.at(-1)?.verifiedDeliverableIndex).toBeGreaterThan(0);
    expect(reduced.metricSnapshots.at(-1)?.openRiskScore).toBe(0);
  });

  it('updates truth deterministically from typed events and replays the same state', () => {
    const events: ExperienceEvent[] = [
      event('evt-prompt-submitted', 'prompt.submitted', {
        artifactId: 'artifact:brief',
        rawPrompt: 'Ship the RC with evidence.',
      }),
      event('evt-prompt-rewritten', 'prompt.rewritten', {
        artifactId: 'artifact:rewritten-prompt',
        sourceArtifactId: 'artifact:brief',
        rewrittenPrompt: 'Build a release candidate with validation evidence.',
      }),
      event('evt-spec-compiled', 'spec.compiled', {
        artifactId: 'artifact:spec',
        sourceArtifactId: 'artifact:rewritten-prompt',
        title: 'RC spec',
      }),
      event('evt-tdd-plan-created', 'tdd.plan.created', {
        artifactId: 'artifact:tdd-plan',
        sourceArtifactId: 'artifact:spec',
      }),
      missionLaunchedEvent(),
      event('evt-artifact-created', 'artifact.created', {
        artifact: {
          id: 'artifact:checkpoint-evidence',
          missionRunId: 'mission-runtime',
          checkpointId: 'cp-6h',
          artifactType: 'report',
          title: 'Checkpoint evidence',
          evidenceRefs: ['artifact:checkpoint-evidence'],
          createdAt: NOW,
        },
      }),
      event('evt-gate-passed', 'gate.passed', {
        missionRunId: 'mission-runtime',
        gateId: 'schema',
        evidenceRef: 'gate:schema:passed',
      }),
      event('evt-checkpoint-completed', 'mission.checkpoint.completed', {
        missionRunId: 'mission-runtime',
        checkpointId: 'cp-6h',
        summary: 'Checkpoint evidence accepted.',
        artifactIds: ['artifact:checkpoint-evidence'],
        vdiDelta: 6,
      }),
      event('evt-quest-completed', 'quest.completed', {
        questId: 'quest-launch-first-deep-mission',
        userId: 'user-one',
        teamId: 'team-alpha',
        evidenceRefs: ['artifact:checkpoint-evidence', 'gate:schema:passed'],
      }),
      event('evt-reward-unlocked', 'reward.unlocked', {
        rewardId: 'reward:mission-control',
        evidenceRefs: ['gate:schema:passed'],
      }),
      event('evt-ledger-recorded', 'ledger.entry.recorded', {
        entry: {
          id: 'ledger-xp-runtime',
          userId: 'user-one',
          teamId: 'team-alpha',
          eventType: 'xp',
          amount: 120,
          currency: 'xp',
          reason: 'Checkpoint accepted with evidence',
          sourceArtifactId: 'artifact:checkpoint-evidence',
          validationGateResultId: 'gate:schema:passed',
          createdAt: NOW,
        },
      }),
    ];

    const reduced = replayExperienceEvents(events);
    const replayed = events.reduce((state, next) => replayExperienceEvents([next], state), createInitialExperienceRuntimeState());

    expect(replayed).toEqual(reduced);
    expect(reduced.activeMissionId).toBe('mission-runtime');
    expect(reduced.artifacts.map((artifact) => artifact.id)).toContain('artifact:checkpoint-evidence');
    expect(reduced.gateResults).toContainEqual({
      id: 'gate:schema:passed',
      missionRunId: 'mission-runtime',
      gateId: 'schema',
      status: 'pass',
      evidenceRef: 'gate:schema:passed',
      blocking: false,
      createdAt: NOW,
    });
    expect(reduced.metricSnapshots.at(-1)?.verifiedDeliverableIndex).toBeGreaterThan(0);
    expect(reduced.questProgress.find((progress) => progress.questId === 'quest-launch-first-deep-mission')?.status).toBe('completed');
    expect(reduced.unlockedRewardIds).toContain('reward:mission-control');
    expect(reduced.notifications.some((notification) => notification.kind === 'reward')).toBe(true);
  });

  it('treats duplicate events as idempotent and keeps Command/Game/Arena projections on one truth', () => {
    const state = replayExperienceEvents([
      missionLaunchedEvent('evt-mission-launched'),
      missionLaunchedEvent('evt-mission-launched'),
      event('evt-gate-warned', 'gate.warned', {
        missionRunId: 'mission-runtime',
        gateId: 'fact_check',
        evidenceRef: 'gate:fact:warn',
      }),
      event('evt-gate-warned', 'gate.warned', {
        missionRunId: 'mission-runtime',
        gateId: 'fact_check',
        evidenceRef: 'gate:fact:warn',
      }),
    ]);

    expect(state.missions).toHaveLength(1);
    expect(state.gateResults).toHaveLength(1);

    const command = selectExperienceRuntimeProjection(state, 'command');
    const game = selectExperienceRuntimeProjection(state, 'game');
    const arena = selectExperienceRuntimeProjection(state, 'arena');

    expect(command.truth.missionId).toBe('mission-runtime');
    expect(game.truth).toEqual(command.truth);
    expect(arena.truth).toEqual(command.truth);
    expect(selectActiveExperienceTruthState(state).mission.id).toBe('mission-runtime');
  });

  it('blocks paid entitlement from VDI and progression while requiring evidence for gates and quests', () => {
    expect(() =>
      replayExperienceEvents([
        missionLaunchedEvent(),
        event('evt-quest-without-evidence', 'quest.completed', {
          questId: 'quest-final-deliverable',
          userId: 'user-one',
          teamId: 'team-alpha',
          evidenceRefs: [],
        }),
      ]),
    ).toThrow('Completed quests require artifact or validation gate evidence');

    const paidOnly = replayExperienceEvents([
      missionLaunchedEvent(),
      event('evt-paid-capacity', 'ledger.entry.recorded', {
        entry: {
          id: 'ledger-paid-capacity',
          userId: 'user-one',
          teamId: 'team-alpha',
          eventType: 'entitlement',
          amount: 10,
          currency: 'slots',
          reason: 'Paid capacity increase',
          createdAt: NOW,
        },
      }),
      event('evt-paid-gate-attempt', 'gate.passed', {
        missionRunId: 'mission-runtime',
        gateId: 'security_check',
      }),
    ]);

    expect(paidOnly.gateResults).toHaveLength(0);
    expect(paidOnly.metricSnapshots.at(-1)?.verifiedDeliverableIndex ?? 0).toBe(0);
    expect(paidOnly.capacity.swarmSlots).toBe(10);
  });

  it('requires trust evidence before installing or forking agent packages into runtime truth', () => {
    const trustedPackage = agentPackage();

    const unsupported = replayExperienceEvents([
      missionLaunchedEvent(),
      event('evt-install-without-evidence', 'agent.package.installed', {
        package: trustedPackage,
      }),
      event('evt-fork-without-evidence', 'agent.package.forked', {
        sourcePackageId: trustedPackage.id,
        package: { ...trustedPackage, id: 'pkg-team-critic-fork' },
      }),
    ]);

    expect(unsupported.installedAgentPackageIds).not.toContain(trustedPackage.id);
    expect(unsupported.agentPackages.map((pkg) => pkg.id)).not.toContain(trustedPackage.id);

    const verified = replayExperienceEvents([
      missionLaunchedEvent(),
      event('evt-install-with-evidence', 'agent.package.installed', {
        package: trustedPackage,
        evidenceRefs: ['gate:agent-contract:passed', 'artifact:agent-contract'],
      }),
      event('evt-fork-with-evidence', 'agent.package.forked', {
        sourcePackageId: trustedPackage.id,
        package: { ...trustedPackage, id: 'pkg-team-critic-fork', ownerTeamId: 'team-alpha' },
        evidenceRefs: ['gate:team-registry:passed'],
      }),
    ]);

    expect(verified.installedAgentPackageIds).toContain(trustedPackage.id);
    expect(verified.agentPackages.map((pkg) => pkg.id)).toEqual(['pkg-team-critic', 'pkg-team-critic-fork']);
    expect(
      verified.questProgress.find((progress) => progress.questId === 'quest-install-trusted-agent-package')?.status,
    ).toBe('completed');
    expect(
      verified.questProgress.find((progress) => progress.questId === 'quest-fork-package-team-registry')?.status,
    ).toBe('completed');
  });

  it('denies mission finalization spoofing with missing or failed evidence', () => {
    const forgedRefs = replayExperienceEvents([
      missionLaunchedEvent(),
      event('evt-forged-finalized', 'mission.finalized', {
        missionRunId: 'mission-runtime',
        finalArtifactId: 'artifact:does-not-exist',
        gateEvidenceRefs: ['gate:security:forged-pass'],
      }),
    ]);

    expect(forgedRefs.missions.find((mission) => mission.id === 'mission-runtime')?.status).toBe('queued');
    expect(forgedRefs.metricSnapshots.at(-1)?.verifiedDeliverableIndex ?? 0).toBe(0);

    const failedGate = replayExperienceEvents([
      missionLaunchedEvent(),
      event('evt-final-artifact', 'artifact.created', {
        artifact: {
          id: 'artifact:final-secure',
          missionRunId: 'mission-runtime',
          artifactType: 'final_report',
          title: 'Final secure deliverable',
          evidenceRefs: ['gate:security:failed'],
          createdAt: NOW,
        },
      }),
      event('evt-security-failed', 'gate.failed', {
        missionRunId: 'mission-runtime',
        gateId: 'security_check',
        evidenceRef: 'gate:security:failed',
        blocking: true,
      }),
      event('evt-finalized-on-failed-gate', 'mission.finalized', {
        missionRunId: 'mission-runtime',
        finalArtifactId: 'artifact:final-secure',
        gateEvidenceRefs: ['gate:security:failed'],
      }),
    ]);

    expect(failedGate.missions.find((mission) => mission.id === 'mission-runtime')?.status).toBe('queued');
    expect(failedGate.metricSnapshots.at(-1)?.verifiedDeliverableIndex ?? 0).toBe(0);

    const passingGate = replayExperienceEvents([
      missionLaunchedEvent(),
      event('evt-final-artifact-pass', 'artifact.created', {
        artifact: {
          id: 'artifact:final-secure',
          missionRunId: 'mission-runtime',
          artifactType: 'final_report',
          title: 'Final secure deliverable',
          evidenceRefs: ['gate:security:passed'],
          createdAt: NOW,
        },
      }),
      event('evt-security-passed', 'gate.passed', {
        missionRunId: 'mission-runtime',
        gateId: 'security_check',
        evidenceRef: 'gate:security:passed',
      }),
      event('evt-finalized-on-passing-gate', 'mission.finalized', {
        missionRunId: 'mission-runtime',
        finalArtifactId: 'artifact:final-secure',
        gateEvidenceRefs: ['gate:security:passed'],
      }),
    ]);

    expect(passingGate.missions.find((mission) => mission.id === 'mission-runtime')?.status).toBe('completed');
    expect(passingGate.metricSnapshots.at(-1)?.verifiedDeliverableIndex ?? 0).toBeGreaterThan(0);
  });

  it('persists through the adapter instead of bypassing durable seams', async () => {
    const adapter = createInMemoryExperiencePersistenceAdapter();
    const store = await createExperienceRuntimeStore({ adapter });

    await store.dispatch(missionLaunchedEvent());
    await store.dispatch(event('evt-finalized', 'mission.finalized', {
      missionRunId: 'mission-runtime',
      finalArtifactId: 'artifact:final',
      gateEvidenceRefs: ['gate:schema:passed'],
    }));

    expect(adapter.events).toHaveLength(2);
    expect(adapter.snapshots).toHaveLength(2);

    const rehydrated = await createExperienceRuntimeStore({ adapter });
    expect(rehydrated.getState()).toEqual(store.getState());
  });
});
