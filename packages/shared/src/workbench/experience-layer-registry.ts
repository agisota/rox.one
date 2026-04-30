import { z } from 'zod/v4';

import {
  ExperienceLayerSchema,
  MissionRunSchema,
  type ExperienceLayer,
  type MissionRun,
} from './experience-layer';
import type { ValidationGate } from './product-mode-registry';

const IdSchema = z.string().min(1);

export const ExperienceLayerFeatureFlagSchema = z.enum([
  'mission_control',
  'metrics',
  'audit',
  'quests',
  'skill_tree',
  'agent_xp',
  'arena_runs',
  'leaderboards',
  'swarm_missions',
]);
export type ExperienceLayerFeatureFlag = z.infer<typeof ExperienceLayerFeatureFlagSchema>;

export const ExperienceLayerRegistryEntrySchema = z.object({
  layer: ExperienceLayerSchema,
  labelKey: z.string().min(1),
  descriptionKey: z.string().min(1),
  featureFlags: z.array(ExperienceLayerFeatureFlagSchema).min(1),
  defaultEnabled: z.boolean(),
});
export type ExperienceLayerRegistryEntry = z.infer<typeof ExperienceLayerRegistryEntrySchema>;

export const ExperienceLayerPolicySchema = z.object({
  availableLayers: z.array(ExperienceLayerSchema).min(1),
  disabledLayers: z.array(ExperienceLayerSchema),
  disabledReasons: z.partialRecord(ExperienceLayerSchema, z.string().min(1)),
});
export type ExperienceLayerPolicy = z.infer<typeof ExperienceLayerPolicySchema>;

export const ExperienceLayerSwitchProjectionSchema = z.object({
  fromLayer: ExperienceLayerSchema,
  toLayer: ExperienceLayerSchema,
  allowed: z.boolean(),
  blockedReason: z.string().min(1).optional(),
  truthBefore: z.object({
    missionId: IdSchema,
    artifactIds: z.array(IdSchema),
    requiredGateIds: z.array(z.string().min(1)),
    ledgerRowIds: z.array(IdSchema),
    validationSemanticsMutable: z.literal(false),
    ledgerSemanticsMutable: z.literal(false),
  }),
  truthAfter: z.object({
    missionId: IdSchema,
    artifactIds: z.array(IdSchema),
    requiredGateIds: z.array(z.string().min(1)),
    ledgerRowIds: z.array(IdSchema),
    validationSemanticsMutable: z.literal(false),
    ledgerSemanticsMutable: z.literal(false),
  }),
});
export type ExperienceLayerSwitchProjection = z.infer<typeof ExperienceLayerSwitchProjectionSchema>;

const EXPERIENCE_LAYER_REGISTRY: ExperienceLayerRegistryEntry[] = [
  {
    layer: 'command',
    labelKey: 'experience.layers.command.label',
    descriptionKey: 'experience.layers.command.description',
    featureFlags: ['mission_control', 'metrics', 'audit'],
    defaultEnabled: true,
  },
  {
    layer: 'game',
    labelKey: 'experience.layers.game.label',
    descriptionKey: 'experience.layers.game.description',
    featureFlags: ['quests', 'skill_tree', 'agent_xp'],
    defaultEnabled: false,
  },
  {
    layer: 'arena',
    labelKey: 'experience.layers.arena.label',
    descriptionKey: 'experience.layers.arena.description',
    featureFlags: ['arena_runs', 'leaderboards', 'swarm_missions'],
    defaultEnabled: false,
  },
];

export function getExperienceLayerRegistry(): ExperienceLayerRegistryEntry[] {
  return EXPERIENCE_LAYER_REGISTRY.map((entry) => ExperienceLayerRegistryEntrySchema.parse(entry));
}

export function resolveExperienceLayerPolicy(input: {
  allowGameLayer?: boolean;
  allowArenaLayer?: boolean;
  disabledReason?: string;
}): ExperienceLayerPolicy {
  const availableLayers: ExperienceLayer[] = ['command'];
  const disabledLayers: ExperienceLayer[] = [];
  const disabledReasons: Partial<Record<ExperienceLayer, string>> = {};
  const disabledReason = input.disabledReason ?? 'disabled_by_policy';

  if (input.allowGameLayer === false) {
    disabledLayers.push('game');
    disabledReasons.game = disabledReason;
  } else {
    availableLayers.push('game');
  }

  if (input.allowArenaLayer === false) {
    disabledLayers.push('arena');
    disabledReasons.arena = disabledReason;
  } else {
    availableLayers.push('arena');
  }

  return ExperienceLayerPolicySchema.parse({
    availableLayers,
    disabledLayers,
    disabledReasons,
  });
}

export function getAvailableExperienceLayers(policy: ExperienceLayerPolicy = resolveExperienceLayerPolicy({})): ExperienceLayerRegistryEntry[] {
  const parsedPolicy = ExperienceLayerPolicySchema.parse(policy);
  return getExperienceLayerRegistry().filter((entry) => parsedPolicy.availableLayers.includes(entry.layer));
}

export function projectExperienceLayerSwitch(input: {
  missionRun: MissionRun;
  fromLayer: ExperienceLayer;
  toLayer: ExperienceLayer;
  ledgerRowIds: string[];
  policy?: ExperienceLayerPolicy;
}): ExperienceLayerSwitchProjection {
  const missionRun = MissionRunSchema.parse(input.missionRun);
  const policy = ExperienceLayerPolicySchema.parse(input.policy ?? resolveExperienceLayerPolicy({}));
  const allowed = policy.availableLayers.includes(input.toLayer);
  const truth = buildSwitchTruth(missionRun, input.ledgerRowIds);

  return ExperienceLayerSwitchProjectionSchema.parse({
    fromLayer: input.fromLayer,
    toLayer: input.toLayer,
    allowed,
    blockedReason: allowed ? undefined : policy.disabledReasons[input.toLayer] ?? 'disabled_by_policy',
    truthBefore: truth,
    truthAfter: truth,
  });
}

function buildSwitchTruth(
  missionRun: MissionRun,
  ledgerRowIds: string[],
): {
  missionId: string;
  artifactIds: string[];
  requiredGateIds: ValidationGate[];
  ledgerRowIds: string[];
  validationSemanticsMutable: false;
  ledgerSemanticsMutable: false;
} {
  return {
    missionId: missionRun.id,
    artifactIds: missionRun.sourceArtifactId ? [missionRun.sourceArtifactId] : [],
    requiredGateIds: [...missionRun.requiredGateIds],
    ledgerRowIds: [...ledgerRowIds],
    validationSemanticsMutable: false,
    ledgerSemanticsMutable: false,
  };
}
