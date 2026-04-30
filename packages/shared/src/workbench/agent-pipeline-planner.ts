import { z } from 'zod';
import type { PermissionMode } from '../agent/mode-types';
import {
  ArtifactTypeSchema,
  ProductAgentRoleSchema,
  ProductModeSchema,
  type ArtifactType,
  type ProductAgentRole,
} from './product-mode-registry';
import {
  DEFAULT_OPTION_GRAPH,
  OptionGraphSchema,
  resolveOptionGraphExecutionConfig,
  type OptionGraph,
} from './option-graph';
import { ValidationGateSchema } from './product-mode-registry';

const PermissionModeSchema = z.enum(['safe', 'ask', 'allow-all'] as const);

export const AgentPipelineLaneSchema = z.enum([
  'intake',
  'discovery',
  'planning',
  'testing',
  'implementation',
  'review',
  'verification',
  'synthesis',
] as const);
export type AgentPipelineLane = z.infer<typeof AgentPipelineLaneSchema>;

export const AgentRoleDefinitionSchema = z.object({
  roleId: ProductAgentRoleSchema,
  label: z.string().trim().min(1),
  lane: AgentPipelineLaneSchema,
  responsibilities: z.array(z.string().trim().min(1)).min(1),
  defaultArtifactTypes: z.array(ArtifactTypeSchema).min(1),
});
export type AgentRoleDefinition = z.infer<typeof AgentRoleDefinitionSchema>;

export const AgentPipelineStageSchema = z.object({
  stageId: z.string().trim().min(1),
  roleId: ProductAgentRoleSchema,
  label: z.string().trim().min(1),
  lane: AgentPipelineLaneSchema,
  dependsOn: z.array(z.string().trim().min(1)).default([]),
  responsibilities: z.array(z.string().trim().min(1)).min(1),
  outputArtifactTypes: z.array(ArtifactTypeSchema).min(1),
});
export type AgentPipelineStage = z.infer<typeof AgentPipelineStageSchema>;

export const AgentPipelineHandoffContractSchema = z.object({
  fromStageId: z.string().trim().min(1),
  toStageId: z.string().trim().min(1),
  artifactTypes: z.array(ArtifactTypeSchema).min(1),
  required: z.boolean(),
  validationGates: z.array(ValidationGateSchema).default([]),
});
export type AgentPipelineHandoffContract = z.infer<typeof AgentPipelineHandoffContractSchema>;

export const AgentPipelinePlanInputSchema = z.object({
  planId: z.string().trim().min(1),
  graph: OptionGraphSchema.default(DEFAULT_OPTION_GRAPH),
  rawInput: z.string().trim().min(1),
  modeId: ProductModeSchema,
  permissionMode: PermissionModeSchema,
  selectedOptionIds: z.array(z.string().trim().min(1)).default([]),
  selectedAgents: z.array(ProductAgentRoleSchema).default([]),
});
export interface AgentPipelinePlanInput extends z.input<typeof AgentPipelinePlanInputSchema> {}

export const AgentPipelinePlanSchema = z.object({
  planId: z.string().trim().min(1),
  modeId: ProductModeSchema,
  permissionMode: PermissionModeSchema,
  selectedOptionIds: z.array(z.string().trim().min(1)).default([]),
  skills: z.array(z.string().trim().min(1)).min(1),
  validationGates: z.array(ValidationGateSchema).min(1),
  outputArtifactTypes: z.array(ArtifactTypeSchema).min(1),
  stages: z.array(AgentPipelineStageSchema).min(1),
  handoffContracts: z.array(AgentPipelineHandoffContractSchema),
});
export type AgentPipelinePlan = z.infer<typeof AgentPipelinePlanSchema>;

const ROLE_DEFINITIONS: Record<ProductAgentRole, Omit<AgentRoleDefinition, 'roleId'>> = {
  'intake-agent': {
    label: 'Intake agent',
    lane: 'intake',
    responsibilities: ['Capture the request, constraints, and initial task shape.'],
    defaultArtifactTypes: ['spec'],
  },
  'clarifier-agent': {
    label: 'Clarifier agent',
    lane: 'discovery',
    responsibilities: ['Resolve ambiguous requirements and expose assumptions before planning.'],
    defaultArtifactTypes: ['spec'],
  },
  'spec-writer-agent': {
    label: 'Spec writer agent',
    lane: 'planning',
    responsibilities: ['Convert requirements into structured specs, tasks, and acceptance criteria.'],
    defaultArtifactTypes: ['spec', 'prd', 'tasks'],
  },
  'planner-agent': {
    label: 'Planner agent',
    lane: 'planning',
    responsibilities: ['Sequence work, identify dependencies, and assign validation gates.'],
    defaultArtifactTypes: ['tasks'],
  },
  'research-agent': {
    label: 'Research agent',
    lane: 'discovery',
    responsibilities: ['Gather source-backed evidence and document uncertainty boundaries.'],
    defaultArtifactTypes: ['report', 'file'],
  },
  'builder-agent': {
    label: 'Builder agent',
    lane: 'implementation',
    responsibilities: ['Implement the minimum scoped production change after tests are defined.'],
    defaultArtifactTypes: ['code', 'tasks'],
  },
  'test-agent': {
    label: 'Test agent',
    lane: 'testing',
    responsibilities: ['Write failing tests first and collect validation evidence.'],
    defaultArtifactTypes: ['tasks', 'code'],
  },
  'critic-agent': {
    label: 'Critic agent',
    lane: 'review',
    responsibilities: ['Review logic, security, evidence quality, and regression risk.'],
    defaultArtifactTypes: ['review', 'report'],
  },
  'verifier-agent': {
    label: 'Verifier agent',
    lane: 'verification',
    responsibilities: ['Run completion checks and confirm acceptance criteria are satisfied.'],
    defaultArtifactTypes: ['review', 'report'],
  },
  'synthesizer-agent': {
    label: 'Synthesizer agent',
    lane: 'synthesis',
    responsibilities: ['Merge role outputs into a final decision, report, or handoff.'],
    defaultArtifactTypes: ['report'],
  },
};

const ROLE_ORDER: ProductAgentRole[] = [
  'intake-agent',
  'clarifier-agent',
  'research-agent',
  'spec-writer-agent',
  'planner-agent',
  'test-agent',
  'builder-agent',
  'critic-agent',
  'verifier-agent',
  'synthesizer-agent',
];

const REVIEW_LANES = new Set<AgentPipelineLane>(['review', 'verification', 'synthesis']);

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function stageId(index: number, roleId: ProductAgentRole): string {
  return `stage-${String(index + 1).padStart(3, '0')}-${roleId}`;
}

function roleDefinition(roleId: ProductAgentRole): AgentRoleDefinition {
  return AgentRoleDefinitionSchema.parse({
    roleId,
    ...ROLE_DEFINITIONS[roleId],
  });
}

function orderedRoles(roles: ProductAgentRole[]): ProductAgentRole[] {
  const selected = new Set(roles);
  return ROLE_ORDER.filter((roleId) => selected.has(roleId));
}

function artifactsForRole(role: AgentRoleDefinition, planArtifacts: ArtifactType[]): ArtifactType[] {
  return unique([...role.defaultArtifactTypes, ...planArtifacts]).filter((artifactType) =>
    ['builder-agent', 'test-agent'].includes(role.roleId) ? true : role.defaultArtifactTypes.includes(artifactType),
  );
}

function dependencyForStage(stages: AgentPipelineStage[], stage: AgentPipelineStage): string[] {
  if (stages.length === 0) {
    return [];
  }

  const previous = stages.at(-1);
  if (!previous) {
    return [];
  }

  if (stage.roleId === 'builder-agent') {
    const testStage = stages.find((candidate) => candidate.roleId === 'test-agent');
    return testStage ? [testStage.stageId] : [previous.stageId];
  }
  if (stage.roleId === 'verifier-agent') {
    const criticStage = stages.find((candidate) => candidate.roleId === 'critic-agent');
    return criticStage ? [criticStage.stageId] : [previous.stageId];
  }
  if (stage.roleId === 'synthesizer-agent') {
    const verifierStage = stages.find((candidate) => candidate.roleId === 'verifier-agent');
    return verifierStage ? [verifierStage.stageId] : [previous.stageId];
  }
  if (REVIEW_LANES.has(stage.lane)) {
    return [previous.stageId];
  }
  if (stage.lane === 'testing') {
    const planningStage = [...stages].reverse().find((candidate) => candidate.lane === 'planning');
    return planningStage ? [planningStage.stageId] : [previous.stageId];
  }

  return [previous.stageId];
}

function buildStages(roles: ProductAgentRole[], outputArtifactTypes: ArtifactType[]): AgentPipelineStage[] {
  const stages: AgentPipelineStage[] = [];

  for (const [index, roleId] of roles.entries()) {
    const role = roleDefinition(roleId);
    const stage = AgentPipelineStageSchema.parse({
      stageId: stageId(index, roleId),
      roleId,
      label: role.label,
      lane: role.lane,
      dependsOn: [],
      responsibilities: role.responsibilities,
      outputArtifactTypes: artifactsForRole(role, outputArtifactTypes),
    });

    stages.push({
      ...stage,
      dependsOn: dependencyForStage(stages, stage),
    });
  }

  return stages;
}

function buildHandoffContracts(
  stages: AgentPipelineStage[],
  validationGates: AgentPipelinePlan['validationGates'],
): AgentPipelineHandoffContract[] {
  const contracts: AgentPipelineHandoffContract[] = [];

  for (const stage of stages) {
    for (const dependencyId of stage.dependsOn) {
      const dependency = stages.find((candidate) => candidate.stageId === dependencyId);
      if (!dependency) {
        continue;
      }

      contracts.push(
        AgentPipelineHandoffContractSchema.parse({
          fromStageId: dependency.stageId,
          toStageId: stage.stageId,
          artifactTypes: dependency.outputArtifactTypes,
          required: true,
          validationGates,
        }),
      );
    }
  }

  return contracts;
}

export function getAgentRoleCatalog(): AgentRoleDefinition[] {
  return ProductAgentRoleSchema.options.map(roleDefinition);
}

export function planAgentPipeline(input: AgentPipelinePlanInput): AgentPipelinePlan {
  const parsed = AgentPipelinePlanInputSchema.parse(input);
  const config = resolveOptionGraphExecutionConfig({
    graph: parsed.graph as OptionGraph,
    rawIntent: parsed.rawInput,
    modeId: parsed.modeId,
    permissionMode: parsed.permissionMode as PermissionMode,
    selectedOptionIds: parsed.selectedOptionIds,
  });
  const roles = orderedRoles(unique([...config.agents, ...parsed.selectedAgents]));
  const stages = buildStages(roles, config.outputArtifactTypes);

  return AgentPipelinePlanSchema.parse({
    planId: parsed.planId,
    modeId: parsed.modeId,
    permissionMode: parsed.permissionMode,
    selectedOptionIds: parsed.selectedOptionIds,
    skills: config.skills,
    validationGates: config.validationGates,
    outputArtifactTypes: config.outputArtifactTypes,
    stages,
    handoffContracts: buildHandoffContracts(stages, config.validationGates),
  });
}
