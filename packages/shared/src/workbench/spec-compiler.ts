import { z } from 'zod';
import type { PermissionMode } from '../agent/mode-types';
import {
  ArtifactTypeSchema,
  ProductModeSchema,
  ValidationGateSchema,
  type ArtifactType,
  type ProductMode,
  type ValidationGate,
} from './product-mode-registry';
import {
  DEFAULT_OPTION_GRAPH,
  OptionGraphSchema,
  resolveOptionGraphExecutionConfig,
  type OptionGraph,
  type OptionGraphOption,
  type ResolvedOptionGraphExecutionConfig,
} from './option-graph';

const PermissionModeSchema = z.enum(['safe', 'ask', 'allow-all'] as const);

export const WorkbenchSpecOutputFormatSchema = z.enum([
  'markdown',
  'json',
  'yaml',
  'tasks_markdown',
] as const);
export type WorkbenchSpecOutputFormat = z.infer<typeof WorkbenchSpecOutputFormatSchema>;

export const WorkbenchSpecTaskSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  validationGates: z.array(ValidationGateSchema).default([]),
});
export type WorkbenchSpecTask = z.infer<typeof WorkbenchSpecTaskSchema>;

export const WorkbenchSpecValidationStepSchema = z.object({
  gateId: ValidationGateSchema,
  required: z.boolean(),
  evidence: z.string().trim().min(1),
});
export type WorkbenchSpecValidationStep = z.infer<typeof WorkbenchSpecValidationStepSchema>;

export const WorkbenchSpecRiskSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical'] as const),
  risk: z.string().trim().min(1),
  mitigation: z.string().trim().min(1),
});
export type WorkbenchSpecRisk = z.infer<typeof WorkbenchSpecRiskSchema>;

export const WorkbenchSpecSchema = z.object({
  title: z.string().trim().min(1),
  role: z.string().trim().min(1),
  objective: z.string().trim().min(1),
  context: z.array(z.string().trim().min(1)).min(1),
  assumptions: z.array(z.string().trim().min(1)).min(1),
  constraints: z.array(z.string().trim().min(1)).min(1),
  deliverables: z.array(z.string().trim().min(1)).min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  implementationTasks: z.array(WorkbenchSpecTaskSchema).min(1),
  validationPlan: z.array(WorkbenchSpecValidationStepSchema).min(1),
  risks: z.array(WorkbenchSpecRiskSchema).min(1),
  openQuestions: z.array(z.string().trim().min(1)).default([]),
  outputFormat: WorkbenchSpecOutputFormatSchema,
});
export type WorkbenchSpec = z.infer<typeof WorkbenchSpecSchema>;

export const WorkbenchSpecArtifactMetadataSchema = z.object({
  artifactId: z.string().trim().min(1),
  artifactType: ArtifactTypeSchema,
  createdAt: z.string().datetime(),
  mode: ProductModeSchema,
  labels: z.array(z.string().trim().min(1)).min(1),
  validationGates: z.array(ValidationGateSchema).default([]),
});
export type WorkbenchSpecArtifactMetadata = z.infer<typeof WorkbenchSpecArtifactMetadataSchema>;

export const CompiledWorkbenchSpecSchema = z.object({
  metadata: WorkbenchSpecArtifactMetadataSchema,
  spec: WorkbenchSpecSchema,
  source: z.object({
    rawInput: z.string().trim().min(1),
    selectedOptionIds: z.array(z.string().trim().min(1)).default([]),
    selectedOptionLabels: z.array(z.string().trim().min(1)).default([]),
    skills: z.array(z.string().trim().min(1)).default([]),
    agents: z.array(z.string().trim().min(1)).default([]),
    outputArtifactTypes: z.array(ArtifactTypeSchema).default([]),
  }),
});
export type CompiledWorkbenchSpec = z.infer<typeof CompiledWorkbenchSpecSchema>;

export const CompileWorkbenchSpecInputSchema = z.object({
  graph: OptionGraphSchema.default(DEFAULT_OPTION_GRAPH),
  rawInput: z.string().trim().min(1),
  modeId: ProductModeSchema,
  permissionMode: PermissionModeSchema,
  selectedOptionIds: z.array(z.string().trim().min(1)).default([]),
  title: z.string().trim().min(1).optional(),
  outputFormat: WorkbenchSpecOutputFormatSchema.default('markdown'),
  createdAt: z.string().datetime().optional(),
});
export interface CompileWorkbenchSpecInput extends z.input<typeof CompileWorkbenchSpecInputSchema> {}

export interface WorkbenchSpecArtifactRef {
  artifactId: string;
  artifactType: ArtifactType;
  title: string;
  format: WorkbenchSpecOutputFormat;
}

export interface WorkbenchSpecArtifactRecord extends WorkbenchSpecArtifactRef {
  content: string;
  metadata: WorkbenchSpecArtifactMetadata;
  createdAt: string;
}

export interface WorkbenchSpecArtifactStore {
  saveArtifact(artifact: WorkbenchSpecArtifactRecord): Promise<WorkbenchSpecArtifactRef>;
}

export interface MemorySpecArtifactStore extends WorkbenchSpecArtifactStore {
  getArtifact(artifactId: string): WorkbenchSpecArtifactRecord | undefined;
  listArtifacts(): WorkbenchSpecArtifactRecord[];
}

const VALIDATION_GATE_EVIDENCE: Record<ValidationGate, string> = {
  schema: 'Compiled spec validates against WorkbenchSpecSchema.',
  unit_tests: 'Unit tests cover pure compiler and mode logic.',
  integration_tests: 'Integration tests cover adapters, stores, and service boundaries.',
  ui_tests: 'UI/component tests cover visible state and interactions when UI is changed.',
  e2e_tests: 'E2E/smoke tests cover user-visible workflow changes.',
  fact_check: 'External claims include source-backed evidence or are marked as assumptions.',
  logic_check: 'The spec is internally consistent and has no contradictory requirements.',
  brand_check: 'Brand, tone, and naming match the configured product surface.',
  security_check: 'Security-sensitive behavior is covered by explicit regression tests.',
  rbac_check: 'Role boundaries are tested with deny-by-default cases.',
  quota_check: 'Quota enforcement is tested before writes complete.',
  sync_check: 'Sync operations prove conflict detection and no silent overwrite.',
};

const ROLE_BY_MODE: Record<ProductMode, string> = {
  rewrite: 'Prompt systems editor',
  think: 'Thinking partner facilitator',
  spec: 'AI product architect',
  plan: 'Staff delivery planner',
  build: 'Staff full-stack engineer',
  review: 'Critical review lead',
  verify: 'QA and verification lead',
  board: 'Executive workbench operator',
  tdd: 'TDD release engineer',
  research: 'Research analyst',
};

const OUTPUT_LABELS: Record<ArtifactType, string> = {
  prompt: 'Prompt',
  spec: 'Specification',
  prd: 'PRD',
  tasks: 'TASKS.md',
  code: 'Code changes',
  report: 'Report',
  review: 'Review report',
  file: 'File artifact',
  entity_graph: 'Entity graph',
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeTitle(value: string): string {
  const firstLine = value.trim().split(/\r?\n/u)[0]?.trim() ?? 'Untitled spec';
  const noTrailingPunctuation = firstLine.replace(/[.!?]+$/u, '').trim();
  return noTrailingPunctuation.slice(0, 100) || 'Untitled spec';
}

function slugTimestamp(isoDate: string): string {
  return isoDate.replace(/[:.]/gu, '-');
}

function selectedOptionSummary(option: OptionGraphOption): string {
  if (option.id === 'output:task-pack') {
    return 'TASKS.md backlog';
  }
  if (option.id === 'tdd:test-first') {
    return 'Test-first execution';
  }
  return option.label;
}

function hasOption(config: ResolvedOptionGraphExecutionConfig, optionId: string): boolean {
  return config.selectedOptionIds.includes(optionId);
}

function deriveDeliverables(config: ResolvedOptionGraphExecutionConfig): string[] {
  const outputDeliverables = config.outputArtifactTypes.map((type) => OUTPUT_LABELS[type]);
  const optionDeliverables: string[] = [];

  if (hasOption(config, 'audience:executive')) {
    optionDeliverables.push('Executive summary');
  }
  if (hasOption(config, 'research:research-grade')) {
    optionDeliverables.push('Research evidence table');
  }
  if (hasOption(config, 'tdd:test-first')) {
    optionDeliverables.push('Test plan');
  }

  return unique([...outputDeliverables, ...optionDeliverables]);
}

function deriveAcceptanceCriteria(config: ResolvedOptionGraphExecutionConfig): string[] {
  const criteria = [
    'Compiled spec validates against WorkbenchSpecSchema.',
    'Export output is deterministic for the same input.',
    'TASKS.md contains implementation tasks with acceptance criteria.',
  ];

  if (hasOption(config, 'tdd:test-first')) {
    criteria.push('Tests are written before implementation.');
  }
  if (config.validationGates.includes('fact_check')) {
    criteria.push('Research and factual claims include source-backed evidence.');
  }
  if (config.validationGates.includes('security_check')) {
    criteria.push('Security-sensitive behavior has deny-by-default tests.');
  }

  return unique(criteria);
}

function validationGatesForTddTask(config: ResolvedOptionGraphExecutionConfig): ValidationGate[] {
  return config.validationGates.filter((gate) =>
    ['unit_tests', 'integration_tests', 'ui_tests', 'e2e_tests'].includes(gate),
  );
}

function deriveTasks(config: ResolvedOptionGraphExecutionConfig): WorkbenchSpecTask[] {
  const tasks: WorkbenchSpecTask[] = [];
  const tddGates = validationGatesForTddTask(config);

  if (hasOption(config, 'tdd:test-first')) {
    tasks.push({
      id: 'TDD-001',
      title: 'Write failing tests first',
      description:
        'Add unit/integration/UI/E2E/security tests required by the selected validation gates before implementation.',
      acceptanceCriteria: ['Targeted tests fail for the expected missing implementation reason.'],
      validationGates: tddGates,
    });
  }

  tasks.push({
    id: 'BUILD-001',
    title: 'Implement selected deliverables',
    description: 'Implement the minimum product changes required by the compiled spec.',
    acceptanceCriteria: ['Deliverables are present and wired to the selected mode.'],
    validationGates: ['schema'],
  });

  tasks.push({
    id: 'VERIFY-001',
    title: 'Run validation gates',
    description: 'Run every required validation gate and collect evidence for the worklog.',
    acceptanceCriteria: ['Blocking validation gates pass.'],
    validationGates: tddGates.length > 0 ? tddGates : config.validationGates,
  });

  return tasks;
}

function deriveValidationPlan(config: ResolvedOptionGraphExecutionConfig): WorkbenchSpecValidationStep[] {
  const gates = config.validationGates.filter((gate) => gate !== 'schema');
  const selectedGates = gates.length > 0 ? gates : config.validationGates;

  return selectedGates.map((gateId) => ({
    gateId,
    required: true,
    evidence: VALIDATION_GATE_EVIDENCE[gateId],
  }));
}

function deriveRisks(config: ResolvedOptionGraphExecutionConfig): WorkbenchSpecRisk[] {
  const risks: WorkbenchSpecRisk[] = [
    {
      severity: 'medium',
      risk: 'Compiled output can drift from UI preview if another formatter is introduced.',
      mitigation: 'Keep shared compiler as the single export source of truth.',
    },
    {
      severity: 'medium',
      risk: 'Selected options may imply integrations that are not implemented yet.',
      mitigation: 'Emit explicit validation gates and implementation tasks instead of silently claiming support.',
    },
  ];

  if (config.validationGates.includes('fact_check')) {
    risks.push({
      severity: 'medium',
      risk: 'Research-grade output can overstate evidence without source capture.',
      mitigation: 'Require fact_check validation and cite source artifacts in downstream tasks.',
    });
  }

  return risks;
}

function buildSpec(
  input: z.output<typeof CompileWorkbenchSpecInputSchema>,
  config: ResolvedOptionGraphExecutionConfig,
): WorkbenchSpec {
  const title = input.title ?? normalizeTitle(input.rawInput);
  const selectedOptionLabels = config.selectedOptions.map(selectedOptionSummary);

  return WorkbenchSpecSchema.parse({
    title,
    role: ROLE_BY_MODE[input.modeId],
    objective: `Turn the user request into an executable ${input.modeId} artifact with testable deliverables.`,
    context: [
      input.rawInput,
      `Mode: ${input.modeId}`,
      `Selected options: ${selectedOptionLabels.length > 0 ? selectedOptionLabels.join(', ') : 'none'}`,
    ],
    assumptions: [
      'The selected option graph is the authoritative requirement source.',
      'Implementation will use fake providers or adapters in tests where external systems would otherwise be required.',
    ],
    constraints: [
      'Preserve existing Craft Agents behavior unless the selected spec explicitly changes it.',
      'No real LLM, browser, storage, billing, or cloud calls are required for compiler tests.',
    ],
    deliverables: deriveDeliverables(config),
    acceptanceCriteria: deriveAcceptanceCriteria(config),
    implementationTasks: deriveTasks(config),
    validationPlan: deriveValidationPlan(config),
    risks: deriveRisks(config),
    openQuestions: ['Which workspace/session persistence adapter should own durable storage for this artifact?'],
    outputFormat: input.outputFormat,
  });
}

export function compileWorkbenchSpec(input: CompileWorkbenchSpecInput): CompiledWorkbenchSpec {
  const parsed = CompileWorkbenchSpecInputSchema.parse(input);
  const createdAt = parsed.createdAt ?? new Date().toISOString();
  const config = resolveOptionGraphExecutionConfig({
    graph: parsed.graph,
    rawIntent: parsed.rawInput,
    modeId: parsed.modeId,
    permissionMode: parsed.permissionMode as PermissionMode,
    selectedOptionIds: parsed.selectedOptionIds,
  });
  const spec = buildSpec(parsed, config);
  const metadata = WorkbenchSpecArtifactMetadataSchema.parse({
    artifactId: `spec-${slugTimestamp(createdAt)}-${parsed.modeId}`,
    artifactType: 'spec',
    createdAt,
    mode: parsed.modeId,
    labels: [`mode::${parsed.modeId}`, 'artifact::spec'],
    validationGates: config.validationGates,
  });

  return CompiledWorkbenchSpecSchema.parse({
    metadata,
    spec,
    source: {
      rawInput: parsed.rawInput,
      selectedOptionIds: config.selectedOptionIds,
      selectedOptionLabels: config.selectedOptions.map(selectedOptionSummary),
      skills: config.skills,
      agents: config.agents,
      outputArtifactTypes: config.outputArtifactTypes,
    },
  });
}

function listSection(title: string, values: string[]): string {
  return `## ${title}\n${values.map((value) => `- ${value}`).join('\n')}`;
}

function renderTask(task: WorkbenchSpecTask): string {
  const gates = task.validationGates.length > 0 ? task.validationGates.join(', ') : 'schema';

  return [
    `### ${task.id} - ${task.title}`,
    task.description,
    'Acceptance criteria:',
    ...task.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    `Validation gates: ${gates}`,
  ].join('\n');
}

export function exportWorkbenchSpec(
  compiled: CompiledWorkbenchSpec,
  format: WorkbenchSpecOutputFormat = compiled.spec.outputFormat,
): string {
  const parsed = CompiledWorkbenchSpecSchema.parse(compiled);
  const outputFormat = WorkbenchSpecOutputFormatSchema.parse(format);

  if (outputFormat === 'json') {
    return `${JSON.stringify(parsed, null, 2)}\n`;
  }
  if (outputFormat === 'yaml') {
    return toYaml(parsed);
  }
  if (outputFormat === 'tasks_markdown') {
    return renderTasksMarkdown(parsed);
  }

  return `${renderMarkdown(parsed.spec)}\n`;
}

function renderMarkdown(spec: WorkbenchSpec): string {
  return [
    `# ${spec.title}`,
    '',
    '## Role',
    spec.role,
    '',
    '## Objective',
    spec.objective,
    '',
    listSection('Context', spec.context),
    '',
    listSection('Assumptions', spec.assumptions),
    '',
    listSection('Constraints', spec.constraints),
    '',
    listSection('Deliverables', spec.deliverables),
    '',
    listSection('Acceptance Criteria', spec.acceptanceCriteria),
    '',
    '## Implementation Tasks',
    spec.implementationTasks.map(renderTask).join('\n\n'),
    '',
    '## Validation Plan',
    spec.validationPlan
      .map((step) => `- ${step.gateId} (${step.required ? 'required' : 'optional'}): ${step.evidence}`)
      .join('\n'),
    '',
    '## Risks',
    spec.risks
      .map(
        (risk) =>
          `- ${capitalizeSeverity(risk.severity)}: ${risk.risk}\n  Mitigation: ${risk.mitigation}`,
      )
      .join('\n'),
    '',
    listSection('Open Questions', spec.openQuestions),
  ].join('\n');
}

function capitalizeSeverity(severity: WorkbenchSpecRisk['severity']): string {
  return `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
}

function renderTasksMarkdown(compiled: CompiledWorkbenchSpec): string {
  const lines = [`# TASKS - ${compiled.spec.title}`, ''];

  for (const task of compiled.spec.implementationTasks) {
    lines.push(`## ${task.id} - ${task.title}`);
    lines.push(task.description);
    lines.push('');
    lines.push('Acceptance criteria:');
    lines.push(...task.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`));
    lines.push('');
    lines.push(`Validation gates: ${task.validationGates.join(', ') || 'schema'}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function yamlScalar(value: string): string {
  if (value === '') {
    return '""';
  }
  if (/^[A-Za-z0-9_.:/@ -]+$/u.test(value) && !/^[-?:,[\]{}#&*!|>'"%@`]/u.test(value)) {
    return value;
  }
  return JSON.stringify(value);
}

function toYaml(value: unknown, indent = 0): string {
  const spaces = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${spaces}[]\n`;
    }
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          return `${spaces}-\n${toYaml(item, indent + 2)}`;
        }
        return `${spaces}- ${toYamlInline(item)}\n`;
      })
      .join('');
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return `${spaces}{}\n`;
    }
    return entries
      .map(([key, item]) => {
        if (Array.isArray(item) || (item !== null && typeof item === 'object')) {
          return `${spaces}${key}:\n${toYaml(item, indent + 2)}`;
        }
        return `${spaces}${key}: ${toYamlInline(item)}\n`;
      })
      .join('');
  }

  return `${spaces}${toYamlInline(value)}\n`;
}

function toYamlInline(value: unknown): string {
  if (typeof value === 'string') {
    return yamlScalar(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  return JSON.stringify(value);
}

export function createMemorySpecArtifactStore(): MemorySpecArtifactStore {
  const artifacts = new Map<string, WorkbenchSpecArtifactRecord>();

  return {
    async saveArtifact(artifact) {
      artifacts.set(artifact.artifactId, artifact);
      return {
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType,
        title: artifact.title,
        format: artifact.format,
      };
    },
    getArtifact(artifactId) {
      return artifacts.get(artifactId);
    },
    listArtifacts() {
      return [...artifacts.values()];
    },
  };
}

export async function saveCompiledWorkbenchSpec(
  store: WorkbenchSpecArtifactStore,
  compiled: CompiledWorkbenchSpec,
  format: WorkbenchSpecOutputFormat = compiled.spec.outputFormat,
): Promise<WorkbenchSpecArtifactRef> {
  const parsed = CompiledWorkbenchSpecSchema.parse(compiled);
  const outputFormat = WorkbenchSpecOutputFormatSchema.parse(format);
  const content = exportWorkbenchSpec(parsed, outputFormat);

  return store.saveArtifact({
    artifactId: parsed.metadata.artifactId,
    artifactType: parsed.metadata.artifactType,
    title: parsed.spec.title,
    format: outputFormat,
    content,
    metadata: parsed.metadata,
    createdAt: parsed.metadata.createdAt,
  });
}
