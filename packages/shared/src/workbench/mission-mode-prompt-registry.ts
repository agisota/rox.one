import { z } from 'zod/v4';

import { MissionModeSchema, type MissionMode } from './experience-layer';
import { ArtifactTypeSchema, ValidationGateSchema, type ArtifactType, type ValidationGate } from './product-mode-registry';

export const MissionProviderCapabilitySchema = z.enum([
  'llm',
  'research',
  'object_storage',
  'email',
  'billing',
  'shortlink',
  'scheduler',
  'agent_registry',
] as const);
export type MissionProviderCapability = z.infer<typeof MissionProviderCapabilitySchema>;

export const MissionModeFailureModeSchema = z.enum([
  'missing_input',
  'malformed_output',
  'missing_artifact',
  'missing_evidence',
  'gate_failed',
  'provider_timeout',
  'provider_unavailable',
  'secret_leak',
  'budget_exhausted',
  'approval_required',
] as const);
export type MissionModeFailureMode = z.infer<typeof MissionModeFailureModeSchema>;

export const MissionCheckpointBehaviorSchema = z.object({
  cadence: z.enum(['per_checkpoint', 'continuous', 'final_only']),
  requiresEvidence: z.literal(true),
  approvalRequiredForExpensiveBranch: z.boolean(),
});
export type MissionCheckpointBehavior = z.infer<typeof MissionCheckpointBehaviorSchema>;

export const MissionModePromptContractSchema = z.object({
  mode: MissionModeSchema,
  role: z.string().min(1),
  objective: z.string().min(1),
  inputContract: z.object({
    requiredFields: z.array(z.string().min(1)).min(1),
    optionalFields: z.array(z.string().min(1)).default([]),
  }),
  outputContract: z.object({
    requiredFields: z.array(z.string().min(1)).min(1),
    artifactType: ArtifactTypeSchema,
  }),
  requiredArtifacts: z.array(ArtifactTypeSchema).min(1),
  validationGates: z.array(ValidationGateSchema).min(1),
  checkpointBehavior: MissionCheckpointBehaviorSchema,
  providerCapabilities: z.array(MissionProviderCapabilitySchema).min(1),
  failureModes: z.array(MissionModeFailureModeSchema).min(1),
  promptTemplate: z.string().min(1),
});
export type MissionModePromptContract = z.infer<typeof MissionModePromptContractSchema>;

export type CompileMissionModePromptInput = {
  missionRunId: string;
  title: string;
  objective: string;
  rawInput: string;
  checkpointOrdinal?: number;
};

const MISSION_MODE_PROMPT_REGISTRY: MissionModePromptContract[] = [
  contract({
    mode: 'deep_run',
    role: 'Long-running mission operator',
    objective: 'Execute a durable mission through checkpointed evidence and final validation.',
    requiredArtifacts: ['report', 'review'],
    validationGates: ['schema', 'logic_check', 'fact_check', 'security_check'],
    providerCapabilities: ['llm', 'scheduler', 'object_storage'],
    checkpointBehavior: { cadence: 'per_checkpoint', requiresEvidence: true, approvalRequiredForExpensiveBranch: true },
    failureModes: ['missing_evidence', 'gate_failed', 'provider_timeout', 'budget_exhausted', 'approval_required'],
  }),
  contract({
    mode: 'deep_reasoning_lab',
    role: 'Reasoning lab facilitator',
    objective: 'Explore competing hypotheses, assumptions, and evidence before execution.',
    requiredArtifacts: ['report', 'spec'],
    validationGates: ['schema', 'logic_check', 'fact_check'],
    providerCapabilities: ['llm', 'research'],
    checkpointBehavior: { cadence: 'per_checkpoint', requiresEvidence: true, approvalRequiredForExpensiveBranch: false },
    failureModes: ['missing_input', 'malformed_output', 'missing_evidence', 'gate_failed'],
  }),
  contract({
    mode: 'agenda_carnage',
    role: 'Agenda demolition reviewer',
    objective: 'Attack weak plans, remove unsupported work, and return an evidence-backed fix order.',
    requiredArtifacts: ['review', 'tasks'],
    validationGates: ['schema', 'logic_check', 'security_check'],
    providerCapabilities: ['llm'],
    checkpointBehavior: { cadence: 'final_only', requiresEvidence: true, approvalRequiredForExpensiveBranch: false },
    failureModes: ['malformed_output', 'missing_evidence', 'gate_failed'],
  }),
  contract({
    mode: 'swarm_arena',
    role: 'Swarm arena coordinator',
    objective: 'Coordinate selected trusted agents, dedupe signals, and produce a gated branch draft.',
    requiredArtifacts: ['prompt', 'tasks', 'review'],
    validationGates: ['schema', 'logic_check', 'fact_check', 'security_check'],
    providerCapabilities: ['llm', 'agent_registry', 'scheduler'],
    checkpointBehavior: { cadence: 'continuous', requiresEvidence: true, approvalRequiredForExpensiveBranch: true },
    failureModes: ['missing_artifact', 'missing_evidence', 'provider_unavailable', 'approval_required'],
  }),
  contract({
    mode: 'round_table',
    role: 'Round-table synthesis chair',
    objective: 'Collect role-specific arguments and synthesize a decision record with minority reports.',
    requiredArtifacts: ['report', 'review'],
    validationGates: ['schema', 'logic_check', 'fact_check'],
    providerCapabilities: ['llm', 'research'],
    checkpointBehavior: { cadence: 'final_only', requiresEvidence: true, approvalRequiredForExpensiveBranch: false },
    failureModes: ['malformed_output', 'missing_evidence', 'gate_failed'],
  }),
  contract({
    mode: 'autoresearch_loop',
    role: 'Autoresearch loop operator',
    objective: 'Run bounded research iterations with citations, contradictions, and freshness checks.',
    requiredArtifacts: ['report', 'file'],
    validationGates: ['schema', 'fact_check', 'logic_check'],
    providerCapabilities: ['research', 'llm', 'object_storage'],
    checkpointBehavior: { cadence: 'per_checkpoint', requiresEvidence: true, approvalRequiredForExpensiveBranch: false },
    failureModes: ['provider_timeout', 'missing_evidence', 'malformed_output', 'gate_failed'],
  }),
  contract({
    mode: 'proactive_watchtower',
    role: 'Proactive watchtower operator',
    objective: 'Monitor a bounded watch target and emit only evidence-backed alerts or blockers.',
    requiredArtifacts: ['report', 'file'],
    validationGates: ['schema', 'fact_check', 'security_check'],
    providerCapabilities: ['research', 'scheduler', 'email'],
    checkpointBehavior: { cadence: 'continuous', requiresEvidence: true, approvalRequiredForExpensiveBranch: true },
    failureModes: ['provider_timeout', 'provider_unavailable', 'secret_leak', 'approval_required'],
  }),
];

export function getMissionModePromptRegistry(): MissionModePromptContract[] {
  return MISSION_MODE_PROMPT_REGISTRY.map(copyContract);
}

export function getMissionModePromptContract(mode: MissionMode): MissionModePromptContract {
  const contract = MISSION_MODE_PROMPT_REGISTRY.find((candidate) => candidate.mode === mode);
  if (!contract) {
    throw new Error(`Unknown mission mode prompt contract: ${mode}`);
  }

  return copyContract(contract);
}

export function compileMissionModePrompt(
  contractInput: MissionModePromptContract,
  input: CompileMissionModePromptInput,
): string {
  const contract = MissionModePromptContractSchema.parse(contractInput);
  const checkpointLabel = input.checkpointOrdinal ? `Checkpoint ${input.checkpointOrdinal}` : 'Mission start';

  return [
    `Role: ${contract.role}`,
    `Mission mode: ${contract.mode}`,
    `Mission run: ${input.missionRunId}`,
    `Title: ${input.title}`,
    `Objective: ${input.objective}`,
    `Input: ${input.rawInput}`,
    `Checkpoint: ${checkpointLabel}`,
    `Required artifacts: ${contract.requiredArtifacts.join(', ')}`,
    `Validation gates: ${contract.validationGates.join(', ')}`,
    `Output fields: ${contract.outputContract.requiredFields.join(', ')}`,
    `Provider capabilities: ${contract.providerCapabilities.join(', ')}`,
    `Failure modes: ${contract.failureModes.join(', ')}`,
    'Return deterministic JSON-compatible content. Do not call external providers directly.',
  ].join('\n');
}

function contract(input: {
  mode: MissionMode;
  role: string;
  objective: string;
  requiredArtifacts: ArtifactType[];
  validationGates: ValidationGate[];
  providerCapabilities: MissionProviderCapability[];
  checkpointBehavior: MissionCheckpointBehavior;
  failureModes: MissionModeFailureMode[];
}): MissionModePromptContract {
  return MissionModePromptContractSchema.parse({
    mode: input.mode,
    role: input.role,
    objective: input.objective,
    inputContract: {
      requiredFields: ['missionRunId', 'title', 'objective', 'rawInput'],
      optionalFields: ['checkpointOrdinal', 'selectedAgentPackageIds', 'budgetCapCredits'],
    },
    outputContract: {
      requiredFields: ['summary', 'artifacts', 'evidenceRefs', 'gateResults', 'nextCheckpoint'],
      artifactType: input.requiredArtifacts[0],
    },
    requiredArtifacts: input.requiredArtifacts,
    validationGates: input.validationGates,
    checkpointBehavior: input.checkpointBehavior,
    providerCapabilities: input.providerCapabilities,
    failureModes: input.failureModes,
    promptTemplate: `${input.role}: ${input.objective}`,
  });
}

function copyContract(contract: MissionModePromptContract): MissionModePromptContract {
  return {
    ...contract,
    inputContract: {
      requiredFields: [...contract.inputContract.requiredFields],
      optionalFields: [...contract.inputContract.optionalFields],
    },
    outputContract: {
      ...contract.outputContract,
      requiredFields: [...contract.outputContract.requiredFields],
    },
    requiredArtifacts: [...contract.requiredArtifacts],
    validationGates: [...contract.validationGates],
    checkpointBehavior: { ...contract.checkpointBehavior },
    providerCapabilities: [...contract.providerCapabilities],
    failureModes: [...contract.failureModes],
  };
}
