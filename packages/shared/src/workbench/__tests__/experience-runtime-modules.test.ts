import { describe, expect, it } from 'bun:test';

import {
  createInitialExperienceRuntimeState,
  replayExperienceEvents,
  type ExperienceEvent,
} from '../experience-runtime-store';
import { projectExperienceMetricSnapshots } from '../experience-metric-engine';
import {
  EXPERIENCE_QUEST_GRAPH,
  projectExperienceQuestProgress,
} from '../experience-quest-engine';

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

function missionLaunchedEvent(): ExperienceEvent {
  return event('evt-module-mission-launched', 'mission.launched', {
    mission: {
      id: 'mission-module-runtime',
      ownerUserId: 'user-one',
      workspaceId: 'workspace-main',
      mode: 'deep_run',
      experienceLayer: 'command',
      title: 'Runtime module mission',
      objective: 'Keep projection logic deep and testable.',
      durationHours: 24,
      checkpointCadenceHours: 6,
      status: 'running',
      vdiTarget: 80,
      budgetCapCredits: 120,
      tokenCap: 500_000,
      storageCapBytes: 536_870_912,
      selectedAgentPackageIds: ['agent-1'],
      requiredGateIds: ['schema', 'logic_check', 'security_check'],
      createdAt: NOW,
      startedAt: NOW,
    },
    checkpoints: [],
  });
}

describe('Experience runtime projection Modules', () => {
  it('projects quest progress from a dedicated evidence-aware Module', () => {
    const submitted = event('evt-module-prompt-submitted', 'prompt.submitted', {
      artifactId: 'artifact:module-prompt',
      rawPrompt: 'Build runtime truth with evidence.',
    });

    const state = projectExperienceQuestProgress(createInitialExperienceRuntimeState(), submitted);

    expect(EXPERIENCE_QUEST_GRAPH[0]?.id).toBe('quest-frame-raw-prompt');
    expect(state.questProgress.find((progress) => progress.questId === 'quest-frame-raw-prompt')).toMatchObject({
      status: 'completed',
      percent: 100,
      evidenceRefs: ['artifact:module-prompt'],
    });
  });

  it('projects metrics from a dedicated Module without letting paid capacity raise VDI', () => {
    const launched = replayExperienceEvents([missionLaunchedEvent()]);
    const paidEvent = event('evt-module-paid-capacity', 'ledger.entry.recorded', {
      entry: {
        id: 'ledger-module-paid-capacity',
        userId: 'user-one',
        eventType: 'entitlement',
        amount: 100,
        currency: 'slots',
        reason: 'Paid capacity only',
        createdAt: NOW,
      },
    });
    const paidState = replayExperienceEvents([paidEvent], launched);

    const snapshots = projectExperienceMetricSnapshots(paidState, paidEvent);

    expect(snapshots.at(-1)?.verifiedDeliverableIndex ?? 0).toBe(0);
    expect(snapshots.at(-1)?.openRiskScore ?? 0).toBe(0);
  });
});
