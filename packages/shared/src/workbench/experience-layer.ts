import { z } from 'zod/v4';

import { ValidationGateSchema, type ValidationGate } from './product-mode-registry';

export const ExperienceLayerSchema = z.enum(['command', 'game', 'arena']);
export type ExperienceLayer = z.infer<typeof ExperienceLayerSchema>;

const IsoDateStringSchema = z.string().min(1);
const IdSchema = z.string().min(1);
const PercentScoreSchema = z.number().min(0).max(100);
const NonNegativeNumberSchema = z.number().min(0);
const PositiveNumberSchema = z.number().positive();
const NonEmptyStringArraySchema = z.array(z.string().min(1)).min(1);

export const MissionModeSchema = z.enum([
  'deep_run',
  'deep_reasoning_lab',
  'agenda_carnage',
  'swarm_arena',
  'round_table',
  'autoresearch_loop',
  'proactive_watchtower',
]);
export type MissionMode = z.infer<typeof MissionModeSchema>;

export const MissionRunStatusSchema = z.enum([
  'draft',
  'queued',
  'running',
  'waiting_for_approval',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);
export type MissionRunStatus = z.infer<typeof MissionRunStatusSchema>;

export const MissionCheckpointStatusSchema = z.enum(['queued', 'running', 'completed', 'blocked', 'failed']);
export type MissionCheckpointStatus = z.infer<typeof MissionCheckpointStatusSchema>;

export const AgentPackageTypeSchema = z.enum(['persona', 'skill', 'skill_pack', 'swarm_pack', 'review_pack']);
export type AgentPackageType = z.infer<typeof AgentPackageTypeSchema>;

export const AgentPackageVisibilitySchema = z.enum(['built_in', 'private', 'team', 'public']);
export type AgentPackageVisibility = z.infer<typeof AgentPackageVisibilitySchema>;

export const AgentPackageRaritySchema = z.enum(['common', 'rare', 'epic', 'legendary']);
export type AgentPackageRarity = z.infer<typeof AgentPackageRaritySchema>;

export const AgentRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AgentRiskLevel = z.infer<typeof AgentRiskLevelSchema>;

export const QuestLaneSchema = z.enum(['formulate', 'specify', 'execute', 'verify', 'marketplace', 'team', 'arena']);
export type QuestLane = z.infer<typeof QuestLaneSchema>;

export const QuestProgressStatusSchema = z.enum(['locked', 'available', 'active', 'completed', 'expired']);
export type QuestProgressStatus = z.infer<typeof QuestProgressStatusSchema>;

export const ProgressLedgerEventTypeSchema = z.enum(['xp', 'credit', 'entitlement', 'penalty', 'unlock']);
export type ProgressLedgerEventType = z.infer<typeof ProgressLedgerEventTypeSchema>;

export const ProgressLedgerCurrencySchema = z.enum(['xp', 'credits', 'slots', 'storage', 'trust', 'mastery']);
export type ProgressLedgerCurrency = z.infer<typeof ProgressLedgerCurrencySchema>;

export const ContributionSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type ContributionSeverity = z.infer<typeof ContributionSeveritySchema>;

export const AgentRunStatusSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const ExperiencePreferenceSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    teamId: IdSchema.optional(),
    defaultLayer: ExperienceLayerSchema,
    allowedLayers: z.array(ExperienceLayerSchema).min(1),
    showLeaderboards: z.boolean(),
    showQuestLanguage: z.boolean(),
    showArenaLanguage: z.boolean(),
    createdAt: IsoDateStringSchema,
    updatedAt: IsoDateStringSchema,
  })
  .superRefine((preference, ctx) => {
    if (!preference.allowedLayers.includes(preference.defaultLayer)) {
      ctx.addIssue({
        code: 'custom',
        message: 'defaultLayer must be included in allowedLayers',
        path: ['defaultLayer'],
      });
    }
  });
export type ExperiencePreference = z.infer<typeof ExperiencePreferenceSchema>;

export const MissionRunSchema = z
  .object({
    id: IdSchema,
    ownerUserId: IdSchema,
    teamId: IdSchema.optional(),
    workspaceId: IdSchema,
    sourceArtifactId: IdSchema.optional(),
    mode: MissionModeSchema,
    experienceLayer: ExperienceLayerSchema,
    title: z.string().min(1),
    objective: z.string().min(1),
    durationHours: PositiveNumberSchema,
    checkpointCadenceHours: PositiveNumberSchema,
    status: MissionRunStatusSchema,
    vdiTarget: PercentScoreSchema,
    budgetCapCredits: NonNegativeNumberSchema,
    tokenCap: z.number().int().min(0),
    storageCapBytes: z.number().int().min(0),
    selectedAgentPackageIds: z.array(IdSchema),
    requiredGateIds: z.array(ValidationGateSchema).min(1),
    createdAt: IsoDateStringSchema,
    startedAt: IsoDateStringSchema.optional(),
    completedAt: IsoDateStringSchema.optional(),
  })
  .superRefine((mission, ctx) => {
    if (mission.durationHours % mission.checkpointCadenceHours !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'durationHours must be divisible by checkpointCadenceHours',
        path: ['checkpointCadenceHours'],
      });
    }
  });
export type MissionRun = z.infer<typeof MissionRunSchema>;

export const MissionCheckpointSchema = z.object({
  id: IdSchema,
  missionRunId: IdSchema,
  ordinal: z.number().int().min(0),
  dueAt: IsoDateStringSchema,
  completedAt: IsoDateStringSchema.optional(),
  title: z.string().min(1),
  summary: z.string(),
  artifactIds: z.array(IdSchema),
  vdiDelta: z.number(),
  status: MissionCheckpointStatusSchema,
});
export type MissionCheckpoint = z.infer<typeof MissionCheckpointSchema>;

export const AgentPackageSchema = z.object({
  id: IdSchema,
  packageType: AgentPackageTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  ownerUserId: IdSchema.optional(),
  ownerTeamId: IdSchema.optional(),
  visibility: AgentPackageVisibilitySchema,
  rarity: AgentPackageRaritySchema,
  trustScore: PercentScoreSchema,
  riskLevel: AgentRiskLevelSchema,
  permissionProfileId: IdSchema,
  latestVersion: z.string().min(1),
  pricingModel: z.string().min(1),
  createdAt: IsoDateStringSchema,
  updatedAt: IsoDateStringSchema,
});
export type AgentPackage = z.infer<typeof AgentPackageSchema>;

export const SkillContractSchema = z.object({
  id: IdSchema,
  packageId: IdSchema,
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  examples: z.array(
    z.object({
      input: z.unknown(),
      output: z.unknown(),
    }),
  ),
  requiredTools: z.array(z.string().min(1)),
  requiredPermissions: z.array(z.string().min(1)),
  requiredValidationGates: z.array(ValidationGateSchema),
  failureModes: z.array(z.string().min(1)),
  testFixtures: z.array(z.string().min(1)),
});
export type SkillContract = z.infer<typeof SkillContractSchema>;

export const AgentRunSchema = z.object({
  id: IdSchema,
  missionRunId: IdSchema,
  agentPackageId: IdSchema,
  status: AgentRunStatusSchema,
  startedAt: IsoDateStringSchema.optional(),
  completedAt: IsoDateStringSchema.optional(),
  contributionCount: z.number().int().min(0),
  acceptedContributionCount: z.number().int().min(0),
  duplicateContributionCount: z.number().int().min(0),
  hallucinationPenalty: NonNegativeNumberSchema,
  costCredits: NonNegativeNumberSchema,
  confidence: PercentScoreSchema,
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const ContributionSchema = z.object({
  id: IdSchema,
  agentRunId: IdSchema,
  claim: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)),
  uniquenessScore: PercentScoreSchema,
  severity: ContributionSeveritySchema,
  accepted: z.boolean(),
  rejectionReason: z.string().min(1).optional(),
  resultingArtifactId: IdSchema.optional(),
});
export type Contribution = z.infer<typeof ContributionSchema>;

export const MetricSnapshotSchema = z.object({
  id: IdSchema,
  missionRunId: IdSchema.optional(),
  artifactId: IdSchema.optional(),
  userId: IdSchema.optional(),
  teamId: IdSchema.optional(),
  qualityScore: PercentScoreSchema,
  executionReadiness: PercentScoreSchema,
  verifiedDeliverableIndex: PercentScoreSchema,
  costEfficiency: NonNegativeNumberSchema,
  openRiskScore: PercentScoreSchema,
  noiseScore: PercentScoreSchema,
  evidenceRefs: NonEmptyStringArraySchema,
  createdAt: IsoDateStringSchema,
});
export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

export const QuestSchema = z.object({
  id: IdSchema,
  campaignId: IdSchema.optional(),
  lane: QuestLaneSchema,
  defaultLayer: ExperienceLayerSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  requirements: NonEmptyStringArraySchema,
  rewards: z.array(z.string().min(1)),
  unlocks: z.array(z.string().min(1)),
  expiresAt: IsoDateStringSchema.optional(),
});
export type Quest = z.infer<typeof QuestSchema>;

export const QuestProgressSchema = z
  .object({
    id: IdSchema,
    questId: IdSchema,
    userId: IdSchema.optional(),
    teamId: IdSchema.optional(),
    status: QuestProgressStatusSchema,
    percent: PercentScoreSchema,
    evidenceRefs: z.array(z.string().min(1)),
    completedAt: IsoDateStringSchema.optional(),
  })
  .superRefine((progress, ctx) => {
    if (progress.status === 'completed' && !hasCompletionEvidence(progress.evidenceRefs)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Completed quests require artifact or validation gate evidence',
        path: ['evidenceRefs'],
      });
    }

    if (progress.status === 'completed' && progress.percent !== 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'Completed quests must be exactly 100 percent',
        path: ['percent'],
      });
    }
  });
export type QuestProgress = z.infer<typeof QuestProgressSchema>;

export const ProgressLedgerSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema.optional(),
    teamId: IdSchema.optional(),
    eventType: ProgressLedgerEventTypeSchema,
    amount: z.number(),
    currency: ProgressLedgerCurrencySchema,
    reason: z.string().min(1),
    sourceArtifactId: IdSchema.optional(),
    validationGateResultId: IdSchema.optional(),
    createdAt: IsoDateStringSchema,
  })
  .superRefine((entry, ctx) => {
    if ((entry.eventType === 'xp' || entry.eventType === 'unlock') && !entry.sourceArtifactId && !entry.validationGateResultId) {
      ctx.addIssue({
        code: 'custom',
        message: 'XP and unlock ledger events require artifact or validation gate evidence',
        path: ['sourceArtifactId'],
      });
    }
  });
export type ProgressLedger = z.infer<typeof ProgressLedgerSchema>;

export const SubscriptionEntitlementSchema = z.object({
  id: IdSchema,
  userId: IdSchema.optional(),
  teamId: IdSchema.optional(),
  planId: z.string().min(1),
  swarmSlots: z.number().int().min(0),
  maxMissionHours: PositiveNumberSchema,
  storageQuotaBytes: z.number().int().min(0),
  privateAgentLimit: z.number().int().min(0),
  publicMarketplaceAccess: z.boolean(),
  createdAt: IsoDateStringSchema,
  expiresAt: IsoDateStringSchema.optional(),
});
export type SubscriptionEntitlement = z.infer<typeof SubscriptionEntitlementSchema>;

export const MissionGateResultSchema = z.object({
  gateId: ValidationGateSchema,
  status: z.enum(['pass', 'warn', 'fail']),
  blocking: z.boolean().optional(),
  evidenceRef: z.string().min(1).optional(),
});
export type MissionGateResult = z.infer<typeof MissionGateResultSchema>;

export const MissionCompletionDecisionSchema = z.enum(['pass', 'warn', 'fail']);
export type MissionCompletionDecision = z.infer<typeof MissionCompletionDecisionSchema>;

export type MissionCompletionEvaluation = {
  missionId: string;
  decision: MissionCompletionDecision;
  reasons: string[];
};

export type VerifiedDeliverableIndexInput = {
  qualityScore: number;
  executionReadiness: number;
  validationGatePassRate: number;
  reviewResolutionRate: number;
  artifactCompleteness: number;
  reproducibilityAuditScore: number;
  criticalOpenRiskPenalty: number;
  unsupportedClaimPenalty: number;
};

export type AgentExperienceInput = {
  acceptedUsefulContributions: number;
  severeFindingsAccepted: number;
  gatesImproved: number;
  verifiedArtifactImpact: number;
  duplicateNoisePenalty: number;
  hallucinationPenalty: number;
  permissionViolationPenalty: number;
};

export type SkillMasteryInput = {
  repeatedSuccessfulUse: number;
  evidenceBackedArtifactImpact: number;
  regressionPrevented: number;
  reviewAccepted: number;
  staleOrUnsupportedOutput: number;
};

export function createDefaultExperiencePreference(input: {
  id: string;
  userId: string;
  teamId?: string;
  createdAt: string;
  updatedAt: string;
  allowedLayers?: ExperienceLayer[];
}): ExperiencePreference {
  return ExperiencePreferenceSchema.parse({
    id: input.id,
    userId: input.userId,
    teamId: input.teamId,
    defaultLayer: 'command',
    allowedLayers: input.allowedLayers ?? ['command', 'game', 'arena'],
    showLeaderboards: false,
    showQuestLanguage: false,
    showArenaLanguage: false,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

export function calculateVerifiedDeliverableIndex(input: VerifiedDeliverableIndexInput): number {
  const score =
    0.2 * input.qualityScore +
    0.2 * input.executionReadiness +
    0.25 * input.validationGatePassRate +
    0.15 * input.reviewResolutionRate +
    0.1 * input.artifactCompleteness +
    0.1 * input.reproducibilityAuditScore -
    0.15 * input.criticalOpenRiskPenalty -
    0.1 * input.unsupportedClaimPenalty;

  return clampIntegerScore(Math.floor(score));
}

export function calculateAgentExperience(input: AgentExperienceInput): number {
  return Math.max(
    0,
    input.acceptedUsefulContributions +
      input.severeFindingsAccepted +
      input.gatesImproved +
      input.verifiedArtifactImpact -
      input.duplicateNoisePenalty -
      input.hallucinationPenalty -
      input.permissionViolationPenalty,
  );
}

export function calculateSkillMastery(input: SkillMasteryInput): number {
  return Math.max(
    0,
    input.repeatedSuccessfulUse +
      input.evidenceBackedArtifactImpact +
      input.regressionPrevented +
      input.reviewAccepted -
      input.staleOrUnsupportedOutput,
  );
}

export function projectExperienceLayerView(
  missionRun: MissionRun,
  layer: ExperienceLayer,
): {
  layer: ExperienceLayer;
  presentationLabel: string;
  truth: {
    missionId: string;
    artifactIds: string[];
    requiredGateIds: ValidationGate[];
    validationSemanticsMutable: false;
    ledgerSemanticsMutable: false;
  };
} {
  const mission = MissionRunSchema.parse(missionRun);

  return {
    layer,
    presentationLabel: EXPERIENCE_LAYER_PRESENTATION_LABELS[layer],
    truth: {
      missionId: mission.id,
      artifactIds: mission.sourceArtifactId ? [mission.sourceArtifactId] : [],
      requiredGateIds: [...mission.requiredGateIds],
      validationSemanticsMutable: false,
      ledgerSemanticsMutable: false,
    },
  };
}

export function assertQuestCompletionEvidence(progress: QuestProgress): QuestProgress {
  return QuestProgressSchema.parse(progress);
}

export function paidEntitlementCanSatisfyValidationGate(
  entitlement: SubscriptionEntitlement,
  gateId: ValidationGate,
): false {
  SubscriptionEntitlementSchema.parse(entitlement);
  ValidationGateSchema.parse(gateId);
  return false;
}

export function evaluateMissionCompletion(input: {
  missionId: string;
  elapsedHours: number;
  durationHours: number;
  finalArtifactId?: string;
  requiredGateResults: MissionGateResult[];
  criticalOpenFindings: number;
  budgetExhausted?: boolean;
  blocked?: boolean;
}): MissionCompletionEvaluation {
  const reasons: string[] = [];

  if (!input.finalArtifactId) {
    reasons.push('missing_final_artifact');
  }

  if (input.requiredGateResults.length === 0) {
    reasons.push('missing_required_gate_results');
  }

  if (input.criticalOpenFindings > 0) {
    reasons.push('critical_open_findings');
  }

  if (input.budgetExhausted) {
    reasons.push('budget_exhausted');
  }

  if (input.blocked) {
    reasons.push('blocked');
  }

  let hasWarn = false;
  for (const gateResult of input.requiredGateResults.map((result) => MissionGateResultSchema.parse(result))) {
    if (gateResult.status === 'fail' && gateResult.blocking !== false) {
      reasons.push('blocking_gate_failed');
    } else if (gateResult.status === 'warn') {
      hasWarn = true;
    }
  }

  if (input.elapsedHours >= input.durationHours && !input.finalArtifactId) {
    reasons.push('elapsed_time_without_evidence');
  }

  const hasHardFailure =
    reasons.includes('missing_final_artifact') ||
    reasons.includes('missing_required_gate_results') ||
    reasons.includes('critical_open_findings') ||
    reasons.includes('budget_exhausted') ||
    reasons.includes('blocked') ||
    reasons.includes('blocking_gate_failed');

  return {
    missionId: input.missionId,
    decision: hasHardFailure ? 'fail' : hasWarn ? 'warn' : 'pass',
    reasons: [...new Set(reasons)],
  };
}

const EXPERIENCE_LAYER_PRESENTATION_LABELS: Record<ExperienceLayer, string> = {
  command: 'Mission Control',
  game: 'Quest Run',
  arena: 'Arena Mission',
};

function hasCompletionEvidence(evidenceRefs: string[]): boolean {
  return evidenceRefs.some((evidenceRef) => evidenceRef.startsWith('artifact:') || evidenceRef.startsWith('gate:'));
}

function clampIntegerScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
