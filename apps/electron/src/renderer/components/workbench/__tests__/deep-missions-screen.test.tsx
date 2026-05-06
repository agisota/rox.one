import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { DeepMissionsScreen } from '../DeepMissionsScreen';
import {
  createCheckpointPreview,
  createDeepMissionEntryState,
  createDeepMissionLaunchPlan,
  createFakeDeepMissionDraftPersistenceAdapter,
  createFakeDeepMissionSchedulerAdapter,
  selectDeepMissionPreset,
  updateDeepMissionDraft,
} from '../deep-missions-state';
import {
  createExperienceRuntimeStore,
  createInMemoryExperiencePersistenceAdapter,
  replayExperienceEvents,
  type ExperienceEvent,
} from '@rox-agent/shared/workbench';

describe('Deep Missions entry screen', () => {
  test('renders long-running run presets and mission controls', () => {
    const state = createDeepMissionEntryState({
      rawInput: 'Deeply review the launch plan for blockers.',
      title: 'Launch plan deep run',
      objective: 'Find blockers and produce a verified fix plan.',
      budgetCapCredits: 250,
    });

    const markup = renderToStaticMarkup(<DeepMissionsScreen initialState={state} />);

    expect(markup).toContain('Долгие миссии');
    expect(markup).toContain('6h Sprint');
    expect(markup).toContain('24h Deep Run');
    expect(markup).toContain('72h Watchtower');
    expect(markup).toContain('Deep Reasoning Lab');
    expect(markup).toContain('Чекпоинты');
    expect(markup).toContain('Запустить миссию');
  });

  test('requires budget cap before launch even when mission text exists', () => {
    const state = createDeepMissionEntryState({
      rawInput: 'Analyze a product strategy.',
      title: 'Strategy deep run',
      objective: 'Create a final decision memo.',
      budgetCapCredits: 0,
    });

    expect(state.canLaunch).toBe(false);
    expect(state.validationErrors).toContain('Budget cap is required before launch.');

    const markup = renderToStaticMarkup(<DeepMissionsScreen initialState={state} />);
    expect(markup).toContain('Перед запуском нужен бюджетный лимит.');
    expect(markup).toContain('disabled=""');
  });

  test('generates deterministic checkpoint cadence previews for presets', () => {
    expect(createCheckpointPreview({ durationHours: 24, checkpointCadenceHours: 6 })).toEqual([
      { ordinal: 0, hour: 0, title: 'Mission brief' },
      { ordinal: 1, hour: 6, title: 'Checkpoint 6h' },
      { ordinal: 2, hour: 12, title: 'Checkpoint 12h' },
      { ordinal: 3, hour: 18, title: 'Checkpoint 18h' },
      { ordinal: 4, hour: 24, title: 'Final verification' },
    ]);

    const state = selectDeepMissionPreset(
      createDeepMissionEntryState({
        rawInput: 'Monitor research freshness.',
        title: 'Watchtower',
        objective: 'Find source drift.',
        budgetCapCredits: 300,
      }),
      'watchtower_72h',
    );

    expect(state.durationHours).toBe(72);
    expect(state.checkpointPreview.map((checkpoint) => checkpoint.hour)).toEqual([0, 12, 24, 36, 48, 60, 72]);
  });

  test('enables launch only when required fields and caps are valid', () => {
    let state = createDeepMissionEntryState({
      rawInput: '',
      title: '',
      objective: '',
      budgetCapCredits: 0,
    });

    expect(state.canLaunch).toBe(false);

    state = updateDeepMissionDraft(state, {
      rawInput: 'Review the agent workbench roadmap.',
      title: 'Roadmap mission',
      objective: 'Produce a verified roadmap risk report.',
      budgetCapCredits: 120,
      tokenCap: 500_000,
      storageCapBytes: 536_870_912,
      vdiTarget: 80,
    });

    expect(state.canLaunch).toBe(true);
    expect(state.validationErrors).toEqual([]);
  });

  test('renders editable mission form fields and honest launch states', () => {
    const state = createDeepMissionEntryState({
      rawInput: 'Review the agent workbench roadmap.',
      title: 'Roadmap mission',
      objective: 'Produce a verified roadmap risk report.',
      budgetCapCredits: 120,
      tokenCap: 500_000,
      storageCapBytes: 536_870_912,
      vdiTarget: 80,
    });

    const markup = renderToStaticMarkup(<DeepMissionsScreen initialState={state} />);

    expect(markup).toContain('Название миссии');
    expect(markup).toContain('Цель миссии');
    expect(markup).toContain('Исходный запрос');
    expect(markup).toContain('Бюджетный лимит');
    expect(markup).toContain('Token cap');
    expect(markup).toContain('Storage cap');
    expect(markup).toContain('Целевой VDI');
    expect(markup).toContain('Состояние: готово');
  });

  test('persists draft and launches through runtime events plus scheduler seam', async () => {
    const state = createDeepMissionEntryState({
      rawInput: 'Review the agent workbench roadmap.',
      title: 'Roadmap mission',
      objective: 'Produce a verified roadmap risk report.',
      budgetCapCredits: 120,
      tokenCap: 500_000,
      storageCapBytes: 536_870_912,
      selectedAgentCount: 8,
      vdiTarget: 80,
    });
    const draftPersistence = createFakeDeepMissionDraftPersistenceAdapter();
    const scheduler = createFakeDeepMissionSchedulerAdapter();
    const runtimeAdapter = createInMemoryExperiencePersistenceAdapter();
    const runtimeStore = await createExperienceRuntimeStore({ adapter: runtimeAdapter });

    const plan = await createDeepMissionLaunchPlan(state, {
      now: '2026-05-06T00:00:00.000Z',
      actorId: 'user-one',
      ownerUserId: 'user-one',
      teamId: 'team-alpha',
      workspaceId: 'workspace-main',
      draftPersistence,
      scheduler,
      runtimeStore,
    });

    expect(plan.status).toBe('launched');
    expect(draftPersistence.savedDrafts).toHaveLength(1);
    expect(scheduler.launchedMissions.map((mission) => mission.id)).toEqual([plan.mission.id]);
    expect(plan.mission.status).toBe('queued');
    expect(scheduler.launchedMissions[0]?.status).toBe('queued');
    expect(runtimeAdapter.events.map((event) => event.type)).toEqual(['mission.drafted', 'mission.launched']);
    expect(runtimeStore.getState().missions[0]?.status).toBe('queued');
    expect(runtimeStore.getState().checkpoints).toHaveLength(4);
  });

  test('does not treat launch as final success without evidence and gates', () => {
    const state = replayExperienceEvents([
      {
        id: 'evt-mission-launched',
        type: 'mission.launched',
        createdAt: '2026-05-06T00:00:00.000Z',
        payload: {
          mission: {
            id: 'mission-no-evidence',
            ownerUserId: 'user-one',
            workspaceId: 'workspace-main',
            mode: 'deep_run',
            experienceLayer: 'command',
            title: 'Roadmap mission',
            objective: 'Produce a verified roadmap risk report.',
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
          checkpoints: [],
        },
      },
      {
        id: 'evt-finalize-without-evidence',
        type: 'mission.finalized',
        createdAt: '2026-05-06T01:00:00.000Z',
        payload: {
          missionRunId: 'mission-no-evidence',
          gateEvidenceRefs: [],
        },
      },
    ] satisfies ExperienceEvent[]);

    expect(state.missions[0]?.status).toBe('queued');
    expect(state.notifications.at(-1)?.kind).toBe('error');
    expect(state.notifications.at(-1)?.message).toContain('requires stored final artifact and passing gate evidence');
  });
});
