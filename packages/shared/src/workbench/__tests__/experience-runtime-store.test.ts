import { describe, expect, it } from 'bun:test';

import {
  createExperienceRuntimeStore,
  createInMemoryExperiencePersistenceAdapter,
  createInitialExperienceRuntimeState,
  replayExperienceEvents,
  selectActiveExperienceTruthState,
  selectExperienceRuntimeProjection,
  type ExperienceEvent,
} from '../experience-runtime-store';

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

describe('ExperienceRuntimeStore', () => {
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
