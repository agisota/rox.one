import { describe, expect, it } from 'bun:test';

import { validateAutomationsConfig } from './validation.ts';
import {
  AutomationPresetConfigSchema,
  applyAutomationPresets,
  applyProductWorkflowAutomationPresets,
  getAutomationPresetCatalog,
  materializeAutomationPreset,
  resolveProductWorkflowAutomationPresetIds,
} from './presets.ts';

describe('automation preset catalog', () => {
  it('ships deterministic prompt-only presets with stable ids', () => {
    const catalog = getAutomationPresetCatalog();

    expect(catalog.map((preset) => preset.presetId)).toEqual([
      'daily-workbench-review',
      'blocked-session-triage',
      'tdd-failure-followup',
    ]);
    expect(catalog.every((preset) => preset.label.length > 0 && preset.description.length > 0)).toBe(true);
    expect(catalog.every((preset) => preset.matcher.actions.every((action) => action.type === 'prompt'))).toBe(true);
  });

  it('materializes a preset into the existing automations config shape', () => {
    const matcher = materializeAutomationPreset('daily-workbench-review', {
      timezone: 'Europe/Moscow',
      enabled: false,
    });

    expect(matcher).toEqual(
      expect.objectContaining({
        id: 'preset-daily-workbench-review',
        name: 'Daily workbench review',
        cron: '0 9 * * 1-5',
        timezone: 'Europe/Moscow',
        permissionMode: 'safe',
        enabled: false,
      }),
    );
    expect(matcher.actions).toHaveLength(1);
    expect(matcher.actions[0]).toEqual(
      expect.objectContaining({
        type: 'prompt',
        prompt: expect.stringContaining('review open Agent Workbench tasks'),
      }),
    );
  });

  it('applies selected presets idempotently and preserves existing automations', () => {
    const config = applyAutomationPresets({
      automations: {
        LabelAdd: [
          {
            id: 'custom-label-hook',
            matcher: 'custom',
            actions: [{ type: 'prompt', prompt: 'Keep this existing matcher.' }],
          },
        ],
      },
    }, {
      presetIds: ['blocked-session-triage', 'blocked-session-triage', 'tdd-failure-followup'],
      timezone: 'Europe/Moscow',
    });

    const secondPass = applyAutomationPresets(config, {
      presetIds: ['blocked-session-triage', 'tdd-failure-followup'],
      timezone: 'Europe/Moscow',
    });

    expect(secondPass).toEqual(config);
    expect(config.automations.LabelAdd?.map((matcher) => matcher.id)).toEqual([
      'custom-label-hook',
      'preset-blocked-session-triage',
      'preset-tdd-failure-followup',
    ]);
    expect(validateAutomationsConfig(config).valid).toBe(true);
  });

  it('rejects unknown preset ids before producing config', () => {
    expect(() =>
      AutomationPresetConfigSchema.parse({
        presetIds: ['daily-workbench-review', 'unknown-preset'],
      }),
    ).toThrow();
  });

  it('applies product workflow automation presets into a valid consumer config', () => {
    const presetIds = resolveProductWorkflowAutomationPresetIds({
      modeId: 'build',
      selectedOptionIds: ['output:task-pack', 'tdd:test-first', 'security:tenant-isolation', 'validation:strict-gates'],
      validationGates: ['unit_tests', 'integration_tests', 'security_check', 'rbac_check'],
    });

    expect(presetIds).toEqual([
      'daily-workbench-review',
      'blocked-session-triage',
      'tdd-failure-followup',
    ]);

    const result = applyProductWorkflowAutomationPresets({
      automations: {},
    }, {
      modeId: 'build',
      selectedOptionIds: ['output:task-pack', 'tdd:test-first', 'security:tenant-isolation', 'validation:strict-gates'],
      validationGates: ['unit_tests', 'integration_tests', 'security_check', 'rbac_check'],
      timezone: 'Europe/Moscow',
    });

    expect(result.presetIds).toEqual(presetIds);
    expect(result.config.automations.SchedulerTick?.map((matcher) => matcher.id)).toEqual([
      'preset-daily-workbench-review',
    ]);
    expect(result.config.automations.LabelAdd?.map((matcher) => matcher.id)).toEqual([
      'preset-blocked-session-triage',
      'preset-tdd-failure-followup',
    ]);
    expect(result.config.automations.SchedulerTick?.[0]?.timezone).toBe('Europe/Moscow');
    expect(validateAutomationsConfig(result.config).valid).toBe(true);
  });
});
