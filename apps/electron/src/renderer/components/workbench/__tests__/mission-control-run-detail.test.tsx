import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MissionControlRunDetail } from '../MissionControlRunDetail';
import {
  approveMissionBranch,
  createMissionControlState,
  createMissionControlStateFromRuntime,
  completeMissionCheckpointThroughRuntime,
  transitionMissionCheckpoint,
} from '../mission-control-state';
import {
  createExperienceRuntimeStore,
  createInMemoryExperiencePersistenceAdapter,
  replayExperienceEvents,
  type ExperienceEvent,
} from '@craft-agent/shared/workbench';

describe('Mission Control run detail', () => {
  test('renders active run timeline, feed, gates, approvals, artifacts, audit, and billing trace', () => {
    const state = createMissionControlState();
    const markup = renderToStaticMarkup(<MissionControlRunDetail initialState={state} />);

    expect(markup).toContain('Центр миссий');
    expect(markup).toContain('Чекпоинт 6h');
    expect(markup).toContain('Лента swarm');
    expect(markup).toContain('Валидационные гейты');
    expect(markup).toContain('Согласования');
    expect(markup).toContain('Промежуточные артефакты');
    expect(markup).toContain('Аудит и биллинг');
  });

  test('checkpoint state transitions are deterministic', () => {
    const state = createMissionControlState();
    const running = transitionMissionCheckpoint(state, 'cp-6h', 'running');
    const completed = transitionMissionCheckpoint(running, 'cp-6h', 'completed');

    expect(running.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('running');
    expect(completed.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('completed');
    expect(completed.auditEvents.at(-1)?.summary).toBe('Checkpoint Checkpoint 6h moved to completed.');
  });

  test('pending approval blocks expensive branch until approved', () => {
    const state = createMissionControlState();

    expect(state.canRunExpensiveBranch).toBe(false);
    expect(state.blockingReasons).toContain('Approval required for expensive branch: 100-agent swarm expansion.');

    const approved = approveMissionBranch(state, 'approval-expensive-branch');
    expect(approved.canRunExpensiveBranch).toBe(true);
    expect(approved.blockingReasons).not.toContain('Approval required for expensive branch: 100-agent swarm expansion.');
  });

  test('critical gate failure blocks final pass even after approval', () => {
    const approved = approveMissionBranch(createMissionControlState(), 'approval-expensive-branch');

    expect(approved.canFinalize).toBe(false);
    expect(approved.blockingReasons).toContain('Critical validation gate failed: security_check.');
  });

  test('interim artifacts render by checkpoint', () => {
    const state = createMissionControlState();
    const markup = renderToStaticMarkup(<MissionControlRunDetail initialState={state} />);

    expect(markup).toContain('6ч карта противоречий');
    expect(markup).toContain('cp-6h');
    expect(markup).toContain('12ч мемо доказательств');
    expect(markup).toContain('cp-12h');
  });

  test('renders launched mission from ExperienceRuntimeState', () => {
    const runtimeState = replayExperienceEvents([missionLaunchedEvent()]);
    const state = createMissionControlStateFromRuntime(runtimeState);
    const markup = renderToStaticMarkup(<MissionControlRunDetail initialState={state} />);

    expect(state.mission.id).toBe('mission-runtime-control');
    expect(state.checkpoints.map((checkpoint) => checkpoint.id)).toEqual(['cp-runtime-6h']);
    expect(markup).toContain('Runtime Control Mission');
    expect(markup).toContain('cp-runtime-6h');
  });

  test('checkpoint completion persists artifact, gate, ledger, and audit events through runtime store', async () => {
    const adapter = createInMemoryExperiencePersistenceAdapter([missionLaunchedEvent()]);
    const runtimeStore = await createExperienceRuntimeStore({ adapter });

    const result = await completeMissionCheckpointThroughRuntime(createMissionControlStateFromRuntime(runtimeStore.getState()), {
      runtimeStore,
      missionRunId: 'mission-runtime-control',
      checkpointId: 'cp-runtime-6h',
      now: '2026-05-06T06:00:00.000Z',
      artifactId: 'artifact:runtime-control-6h',
      artifactTitle: '6h runtime evidence',
      gateId: 'schema',
      gateEvidenceRef: 'gate:schema:runtime-control-pass',
      costCredits: 12,
      summary: 'Checkpoint evidence accepted.',
    });

    expect(result.checkpoints.find((checkpoint) => checkpoint.id === 'cp-runtime-6h')?.status).toBe('completed');
    expect(result.artifacts.map((artifact) => artifact.id)).toContain('artifact:runtime-control-6h');
    expect(result.auditEvents.at(-1)?.summary).toContain('completed');
    expect(result.billingTrace.at(-1)?.credits).toBe(12);

    await completeMissionCheckpointThroughRuntime(result, {
      runtimeStore,
      missionRunId: 'mission-runtime-control',
      checkpointId: 'cp-runtime-6h',
      now: '2026-05-06T06:00:00.000Z',
      artifactId: 'artifact:runtime-control-6h',
      artifactTitle: '6h runtime evidence',
      gateId: 'schema',
      gateEvidenceRef: 'gate:schema:runtime-control-pass',
      costCredits: 12,
      summary: 'Checkpoint evidence accepted.',
    });

    expect(adapter.events.filter((event) => event.type === 'mission.checkpoint.completed')).toHaveLength(1);
  });

  test('runtime finalization remains blocked without final artifact and passing gate evidence', () => {
    const runtimeState = replayExperienceEvents([
      missionLaunchedEvent(),
      {
        id: 'evt-finalize-without-evidence',
        type: 'mission.finalized',
        createdAt: '2026-05-06T07:00:00.000Z',
        payload: {
          missionRunId: 'mission-runtime-control',
          gateEvidenceRefs: [],
        },
      },
    ] satisfies ExperienceEvent[]);
    const state = createMissionControlStateFromRuntime(runtimeState);

    expect(state.mission.status).toBe('running');
    expect(runtimeState.notifications.at(-1)?.kind).toBe('error');
  });
});

function missionLaunchedEvent(): ExperienceEvent {
  return {
    id: 'evt-runtime-control-launched',
    type: 'mission.launched',
    createdAt: '2026-05-06T00:00:00.000Z',
    actorId: 'user-one',
    payload: {
      mission: {
        id: 'mission-runtime-control',
        ownerUserId: 'user-one',
        workspaceId: 'workspace-main',
        mode: 'deep_run',
        experienceLayer: 'command',
        title: 'Runtime Control Mission',
        objective: 'Prove Mission Control reads runtime truth.',
        durationHours: 24,
        checkpointCadenceHours: 6,
        status: 'running',
        vdiTarget: 80,
        budgetCapCredits: 120,
        tokenCap: 500_000,
        storageCapBytes: 536_870_912,
        selectedAgentPackageIds: ['agent-1'],
        requiredGateIds: ['schema', 'logic_check', 'security_check'],
        createdAt: '2026-05-06T00:00:00.000Z',
        startedAt: '2026-05-06T00:00:00.000Z',
      },
      checkpoints: [
        {
          id: 'cp-runtime-6h',
          missionRunId: 'mission-runtime-control',
          ordinal: 1,
          dueAt: '2026-05-06T06:00:00.000Z',
          title: 'Checkpoint 6h',
          summary: '',
          artifactIds: [],
          vdiDelta: 0,
          status: 'queued',
        },
      ],
    },
  };
}
