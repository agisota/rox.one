import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { DeepMissionsScreen } from '../DeepMissionsScreen';
import {
  createCheckpointPreview,
  createDeepMissionEntryState,
  selectDeepMissionPreset,
  updateDeepMissionDraft,
} from '../deep-missions-state';

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
});
