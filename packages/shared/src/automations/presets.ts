import { z } from 'zod';
import { AutomationMatcherSchema } from './schemas.ts';
import type { AutomationEvent, AutomationMatcher, AutomationsConfig } from './types.ts';

export const AutomationPresetIdSchema = z.enum([
  'daily-workbench-review',
  'blocked-session-triage',
  'tdd-failure-followup',
] as const);
export type AutomationPresetId = z.infer<typeof AutomationPresetIdSchema>;

export const AutomationPresetSchema = z.object({
  presetId: AutomationPresetIdSchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  event: z.string().trim().min(1),
  matcher: AutomationMatcherSchema,
});
export interface AutomationPreset {
  presetId: AutomationPresetId;
  label: string;
  description: string;
  event: AutomationEvent;
  matcher: AutomationMatcher;
}

export const AutomationPresetConfigSchema = z.object({
  presetIds: z.array(AutomationPresetIdSchema).min(1),
  timezone: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
});
export type AutomationPresetConfig = z.input<typeof AutomationPresetConfigSchema>;

function parsePreset(input: z.input<typeof AutomationPresetSchema>): AutomationPreset {
  return AutomationPresetSchema.parse(input) as unknown as AutomationPreset;
}

const PRESETS: AutomationPreset[] = [
  parsePreset({
    presetId: 'daily-workbench-review',
    label: 'Daily workbench review',
    description: 'Every weekday morning, ask ROX ONE to summarize open Agent Workbench tasks and risks.',
    event: 'SchedulerTick',
    matcher: {
      id: 'preset-daily-workbench-review',
      name: 'Daily workbench review',
      cron: '0 9 * * 1-5',
      timezone: 'UTC',
      permissionMode: 'safe',
      labels: ['agent-workbench', 'preset:daily-review'],
      enabled: true,
      actions: [
        {
          type: 'prompt',
          prompt:
            'Please review open Agent Workbench tasks, summarize blockers, validation gaps, and the next safest action.',
        },
      ],
    },
  }),
  parsePreset({
    presetId: 'blocked-session-triage',
    label: 'Blocked session triage',
    description: 'When a session is labeled blocked, create a safe triage prompt with evidence and next actions.',
    event: 'LabelAdd',
    matcher: {
      id: 'preset-blocked-session-triage',
      name: 'Blocked session triage',
      matcher: 'blocked|needs-triage',
      permissionMode: 'safe',
      labels: ['agent-workbench', 'preset:blocked-triage'],
      enabled: true,
      actions: [
        {
          type: 'prompt',
          prompt:
            'Triage this blocked Agent Workbench session. Identify the current blocker, evidence already collected, safe alternatives, and the next verification step.',
        },
      ],
    },
  }),
  parsePreset({
    presetId: 'tdd-failure-followup',
    label: 'TDD failure follow-up',
    description: 'When a TDD failure label is added, ask for a minimal failing-test diagnosis and repair plan.',
    event: 'LabelAdd',
    matcher: {
      id: 'preset-tdd-failure-followup',
      name: 'TDD failure follow-up',
      matcher: 'tdd-fail|test-failure|red-phase',
      permissionMode: 'safe',
      labels: ['agent-workbench', 'preset:tdd-followup'],
      enabled: true,
      actions: [
        {
          type: 'prompt',
          prompt:
            'Analyze the failing TDD evidence. State the expected failure, whether it matches the intended red phase, and the smallest implementation path to green.',
        },
      ],
    },
  }),
];

function copyMatcher(matcher: AutomationMatcher): AutomationMatcher {
  return AutomationMatcherSchema.parse(matcher) as AutomationMatcher;
}

function copyPreset(preset: AutomationPreset): AutomationPreset {
  return {
    ...preset,
    matcher: copyMatcher(preset.matcher),
  };
}

function presetById(presetId: AutomationPresetId): AutomationPreset {
  const preset = PRESETS.find((candidate) => candidate.presetId === presetId);
  if (!preset) {
    throw new Error(`Unknown automation preset: ${presetId}`);
  }
  return copyPreset(preset);
}

function matcherId(matcher: AutomationMatcher): string {
  return matcher.id ?? `${matcher.name ?? 'automation'}:${matcher.matcher ?? matcher.cron ?? 'match-all'}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function getAutomationPresetCatalog(): AutomationPreset[] {
  return PRESETS.map(copyPreset);
}

export function materializeAutomationPreset(
  presetId: AutomationPresetId,
  input: Partial<Pick<AutomationMatcher, 'timezone' | 'enabled'>> = {},
): AutomationMatcher {
  const preset = presetById(presetId);
  const matcher = copyMatcher(preset.matcher);

  return AutomationMatcherSchema.parse({
    ...matcher,
    timezone: input.timezone ?? matcher.timezone,
    enabled: input.enabled ?? matcher.enabled,
  }) as AutomationMatcher;
}

export function applyAutomationPresets(
  config: AutomationsConfig,
  input: AutomationPresetConfig,
): AutomationsConfig {
  const parsed = AutomationPresetConfigSchema.parse(input);
  const next: AutomationsConfig = {
    automations: Object.fromEntries(
      Object.entries(config.automations).map(([event, matchers]) => [
        event,
        [...(matchers ?? [])].map(copyMatcher),
      ]),
    ) as AutomationsConfig['automations'],
  };

  for (const presetId of unique(parsed.presetIds)) {
    const preset = presetById(presetId);
    const matcher = materializeAutomationPreset(presetId, {
      timezone: parsed.timezone,
      enabled: parsed.enabled,
    });
    const event = preset.event;
    const existing = next.automations[event] ?? [];
    const exists = existing.some((candidate) => matcherId(candidate) === matcherId(matcher));

    if (!exists) {
      next.automations[event] = [...existing, matcher];
    }
  }

  return next;
}
