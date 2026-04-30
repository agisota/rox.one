import { z } from 'zod';
import type { PermissionMode } from '../agent/mode-types';
import type { WorkbenchBundleSkillSlug } from './bundle-types';
import {
  ArtifactTypeSchema,
  ProductAgentRoleSchema,
  ProductModeSchema,
  ValidationGateSchema,
  resolveProductModeExecutionConfig,
  type ArtifactType,
  type ProductAgentRole,
  type ProductMode,
  type ResolvedProductModeExecutionConfig,
  type ValidationGate,
} from './product-mode-registry';

export const OPTION_GRAPH_CATEGORIES = [
  'output_type',
  'depth',
  'audience',
  'format',
  'style',
  'design',
  'research_depth',
  'geography',
  'recency',
  'source_requirements',
  'api_requirements',
  'security',
  'compliance',
  'testing',
  'tdd',
  'deliverables',
  'diagrams',
  'metrics',
  'risks',
  'validation',
] as const;

const OPTION_GRAPH_SKILL_SLUGS = [
  'prompt-rewriter-pack',
  'thinking-partner-pack',
  'spec-builder-pack',
  'multi-agent-planning-pack',
  'review-board-pack',
  'tdd-qa-verification-pack',
  'research-fact-check-pack',
  'founder-strategy-pack',
  'design-critique-pack',
  'security-compliance-pack',
] as const;

const PERMISSION_MODE_IDS = ['safe', 'ask', 'allow-all'] as const;
const OPTION_GRAPH_FIXTURE_IDS = [
  'product-spec',
  'code-task',
  'market-research',
  'presentation-review',
  'prompt-rewrite',
] as const;

export const OptionGraphCategorySchema = z.enum(OPTION_GRAPH_CATEGORIES);
export type OptionGraphCategory = z.infer<typeof OptionGraphCategorySchema>;

export const OptionGraphSkillSlugSchema = z.enum(OPTION_GRAPH_SKILL_SLUGS);
const PermissionModeSchema = z.enum(PERMISSION_MODE_IDS);
const OptionGraphOptionIdSchema = z.string().trim().min(1);
const OptionGraphSectionSchema = z.string().trim().min(1);

export const OptionGraphConditionSchema = z.object({
  modeIds: z.array(ProductModeSchema).default([]),
  rawIntentIncludes: z.array(z.string().trim().min(1)).default([]),
  selectedOptionIds: z.array(OptionGraphOptionIdSchema).default([]),
});
export type OptionGraphCondition = z.infer<typeof OptionGraphConditionSchema>;

export const OptionGraphOptionSchema = z.object({
  id: OptionGraphOptionIdSchema,
  category: OptionGraphCategorySchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  appliesWhen: z.array(OptionGraphConditionSchema).default([]),
  requires: z.array(OptionGraphOptionIdSchema).default([]),
  excludes: z.array(OptionGraphOptionIdSchema).default([]),
  addsSections: z.array(OptionGraphSectionSchema).default([]),
  addsSkills: z.array(OptionGraphSkillSlugSchema).default([]),
  addsAgents: z.array(ProductAgentRoleSchema).default([]),
  addsValidationGates: z.array(ValidationGateSchema).default([]),
  addsArtifactTypes: z.array(ArtifactTypeSchema).default([]),
  complexityWeight: z.number().int().min(0).default(1),
});
export type OptionGraphOption = z.infer<typeof OptionGraphOptionSchema>;

export const OptionGraphSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  options: z.array(OptionGraphOptionSchema).min(1),
});
export type OptionGraph = z.infer<typeof OptionGraphSchema>;

export const OptionGraphFixtureSchema = z.object({
  id: z.enum(OPTION_GRAPH_FIXTURE_IDS),
  label: z.string().trim().min(1),
  rawIntent: z.string().trim().min(1),
  modeId: ProductModeSchema,
  permissionMode: PermissionModeSchema,
  selectedOptionIds: z.array(OptionGraphOptionIdSchema).min(1),
});
export type OptionGraphFixture = z.infer<typeof OptionGraphFixtureSchema>;
export type OptionGraphFixtureId = OptionGraphFixture['id'];

export interface OptionGraphValidationResult {
  graphId: string;
  optionCount: number;
  categories: OptionGraphCategory[];
}

export interface ResolveOptionGraphOptionsInput {
  graph?: OptionGraph;
  rawIntent: string;
  modeId?: ProductMode;
  selectedOptionIds?: string[];
}

export interface ResolveOptionGraphOptionsResult {
  graph: OptionGraph;
  availableOptions: OptionGraphOption[];
  availableOptionIds: string[];
}

export interface ResolveOptionGraphExecutionConfigInput {
  graph?: OptionGraph;
  rawIntent: string;
  modeId: ProductMode;
  permissionMode: PermissionMode;
  selectedOptionIds: string[];
}

export interface ResolvedOptionGraphExecutionConfig {
  graph: OptionGraph;
  modeConfig: ResolvedProductModeExecutionConfig;
  selectedOptions: OptionGraphOption[];
  selectedOptionIds: string[];
  sections: string[];
  skills: WorkbenchBundleSkillSlug[];
  agents: ProductAgentRole[];
  validationGates: ValidationGate[];
  outputArtifactTypes: ArtifactType[];
  complexityWeight: number;
}

function option(input: z.input<typeof OptionGraphOptionSchema>): OptionGraphOption {
  return OptionGraphOptionSchema.parse(input);
}

export const DEFAULT_OPTION_GRAPH: OptionGraph = OptionGraphSchema.parse({
  id: 'agent-workbench-default-option-graph',
  label: 'Agent Workbench Option Graph',
  description: 'Default selectable requirements for Agent Workbench product modes.',
  options: [
    option({
      id: 'output:prd',
      category: 'output_type',
      label: 'PRD',
      description: 'Produce a product requirements document with acceptance criteria.',
      addsSections: ['objective', 'context', 'acceptance_criteria'],
      addsArtifactTypes: ['prd', 'spec'],
      complexityWeight: 2,
    }),
    option({
      id: 'output:task-pack',
      category: 'output_type',
      label: 'Task pack',
      description: 'Produce implementation tasks with clear validation expectations.',
      addsSections: ['implementation_tasks', 'acceptance_criteria'],
      addsArtifactTypes: ['tasks'],
      complexityWeight: 2,
    }),
    option({
      id: 'output:review-report',
      category: 'output_type',
      label: 'Review report',
      description: 'Produce a review report with severity, evidence, and fix recommendations.',
      addsSections: ['review_scope', 'severity_matrix'],
      addsSkills: ['review-board-pack'],
      addsAgents: ['critic-agent', 'verifier-agent'],
      addsValidationGates: ['logic_check'],
      addsArtifactTypes: ['review', 'report'],
      complexityWeight: 2,
    }),
    option({
      id: 'depth:lean',
      category: 'depth',
      label: 'Lean',
      description: 'Keep the output short and decision-oriented.',
      addsSections: ['summary'],
      complexityWeight: 0,
    }),
    option({
      id: 'depth:implementation-ready',
      category: 'depth',
      label: 'Implementation-ready',
      description: 'Add enough detail for an agent or engineer to execute directly.',
      addsSections: ['constraints', 'acceptance_criteria', 'validation_plan'],
      addsAgents: ['planner-agent', 'verifier-agent'],
      complexityWeight: 2,
    }),
    option({
      id: 'audience:executive',
      category: 'audience',
      label: 'Executive audience',
      description: 'Add a board-ready executive framing section.',
      addsSections: ['executive_summary'],
      complexityWeight: 1,
    }),
    option({
      id: 'audience:developer',
      category: 'audience',
      label: 'Developer audience',
      description: 'Add implementation notes and technical assumptions.',
      addsSections: ['implementation_notes'],
      complexityWeight: 1,
    }),
    option({
      id: 'format:markdown',
      category: 'format',
      label: 'Markdown',
      description: 'Export the result as Markdown.',
      excludes: ['format:json', 'format:yaml'],
      complexityWeight: 0,
    }),
    option({
      id: 'format:json',
      category: 'format',
      label: 'JSON',
      description: 'Export the result as structured JSON.',
      excludes: ['format:markdown', 'format:yaml'],
      complexityWeight: 0,
    }),
    option({
      id: 'format:yaml',
      category: 'format',
      label: 'YAML',
      description: 'Export the result as YAML.',
      excludes: ['format:markdown', 'format:json'],
      complexityWeight: 0,
    }),
    option({
      id: 'style:concise',
      category: 'style',
      label: 'Concise style',
      description: 'Prefer compact wording and direct acceptance criteria.',
      addsSections: ['style_guidance'],
      complexityWeight: 0,
    }),
    option({
      id: 'design:visual-critique',
      category: 'design',
      label: 'Visual critique',
      description: 'Include visual hierarchy, UX, accessibility, and interaction critique.',
      appliesWhen: [{ modeIds: ['review', 'board', 'spec'] }],
      addsSections: ['visual_hierarchy', 'ux_risks'],
      addsSkills: ['design-critique-pack'],
      addsAgents: ['critic-agent'],
      addsValidationGates: ['brand_check'],
      complexityWeight: 2,
    }),
    option({
      id: 'research:research-grade',
      category: 'research_depth',
      label: 'Research-grade',
      description: 'Require source-backed evidence, methodology, and uncertainty boundaries.',
      appliesWhen: [
        { modeIds: ['research', 'spec', 'think'] },
        { rawIntentIncludes: ['research', 'market', 'source', 'citation'] },
      ],
      addsSections: ['methodology'],
      addsSkills: ['research-fact-check-pack'],
      addsAgents: ['research-agent', 'verifier-agent'],
      addsValidationGates: ['fact_check', 'logic_check'],
      addsArtifactTypes: ['report'],
      complexityWeight: 3,
    }),
    option({
      id: 'geography:target-market',
      category: 'geography',
      label: 'Target geography',
      description: 'Add a market/region boundary for claims and recommendations.',
      appliesWhen: [{ rawIntentIncludes: ['market', 'region', 'country', 'geo'] }],
      addsSections: ['regional_scope'],
      complexityWeight: 1,
    }),
    option({
      id: 'recency:current',
      category: 'recency',
      label: 'Current information',
      description: 'Require a currentness boundary and recency-sensitive verification.',
      appliesWhen: [
        { modeIds: ['research'] },
        { rawIntentIncludes: ['current', 'latest', 'recent', 'market', 'research'] },
      ],
      addsSections: ['recency_policy'],
      addsValidationGates: ['fact_check'],
      complexityWeight: 1,
    }),
    option({
      id: 'sources:primary-sources',
      category: 'source_requirements',
      label: 'Primary sources',
      description: 'Prefer official docs, original datasets, filings, or first-party evidence.',
      appliesWhen: [{ selectedOptionIds: ['research:research-grade'] }],
      requires: ['research:research-grade'],
      addsSections: ['source_requirements'],
      addsSkills: ['research-fact-check-pack'],
      addsValidationGates: ['fact_check'],
      complexityWeight: 2,
    }),
    option({
      id: 'api:official-docs',
      category: 'api_requirements',
      label: 'Official API docs',
      description: 'Require official SDK/API documentation and version-aware assumptions.',
      appliesWhen: [
        { modeIds: ['build', 'spec', 'research'] },
        { rawIntentIncludes: ['api', 'sdk', 'docs', 'integration'] },
      ],
      addsSections: ['api_contracts'],
      addsSkills: ['research-fact-check-pack'],
      addsAgents: ['research-agent'],
      addsValidationGates: ['fact_check', 'integration_tests'],
      complexityWeight: 2,
    }),
    option({
      id: 'security:tenant-isolation',
      category: 'security',
      label: 'Tenant isolation',
      description: 'Require RBAC, cross-tenant denial, and secret handling checks.',
      appliesWhen: [
        { modeIds: ['build', 'spec', 'verify'] },
        { rawIntentIncludes: ['team', 'cloud', 'tenant', 'rbac', 'security'] },
      ],
      addsSections: ['security_model'],
      addsSkills: ['security-compliance-pack'],
      addsAgents: ['critic-agent', 'verifier-agent'],
      addsValidationGates: ['security_check', 'rbac_check'],
      complexityWeight: 3,
    }),
    option({
      id: 'compliance:privacy-review',
      category: 'compliance',
      label: 'Privacy review',
      description: 'Add privacy, retention, and auditability constraints.',
      appliesWhen: [{ rawIntentIncludes: ['privacy', 'gdpr', 'compliance', 'audit'] }],
      addsSections: ['compliance_notes'],
      addsSkills: ['security-compliance-pack'],
      addsValidationGates: ['security_check'],
      complexityWeight: 2,
    }),
    option({
      id: 'testing:unit-integration',
      category: 'testing',
      label: 'Unit + integration tests',
      description: 'Require unit and integration test coverage.',
      appliesWhen: [
        { modeIds: ['build', 'tdd', 'verify'] },
        { rawIntentIncludes: ['test', 'build', 'code'] },
      ],
      addsSections: ['test_plan'],
      addsSkills: ['tdd-qa-verification-pack'],
      addsAgents: ['test-agent'],
      addsValidationGates: ['unit_tests', 'integration_tests'],
      complexityWeight: 2,
    }),
    option({
      id: 'tdd:test-first',
      category: 'tdd',
      label: 'Test-first TDD',
      description: 'Generate failing tests before implementation and enforce validation gates.',
      appliesWhen: [
        { modeIds: ['build', 'tdd'] },
        { rawIntentIncludes: ['tdd', 'test-first', 'build'] },
      ],
      addsSections: ['test_plan', 'implementation_tasks'],
      addsSkills: ['tdd-qa-verification-pack'],
      addsAgents: ['test-agent', 'verifier-agent'],
      addsValidationGates: ['unit_tests', 'integration_tests', 'ui_tests', 'e2e_tests'],
      addsArtifactTypes: ['tasks'],
      complexityWeight: 3,
    }),
    option({
      id: 'deliverable:tasks',
      category: 'deliverables',
      label: 'Task breakdown',
      description: 'Add executable tasks with owners, dependencies, and acceptance criteria.',
      addsSections: ['implementation_tasks'],
      addsArtifactTypes: ['tasks'],
      complexityWeight: 1,
    }),
    option({
      id: 'diagram:system-flow',
      category: 'diagrams',
      label: 'System flow diagram',
      description: 'Add a system/data-flow diagram section.',
      addsSections: ['diagrams'],
      addsArtifactTypes: ['report'],
      complexityWeight: 1,
    }),
    option({
      id: 'metrics:success',
      category: 'metrics',
      label: 'Success metrics',
      description: 'Add measurable success and validation metrics.',
      addsSections: ['success_metrics'],
      complexityWeight: 1,
    }),
    option({
      id: 'risk:matrix',
      category: 'risks',
      label: 'Risk matrix',
      description: 'Add explicit risks, mitigations, and residual uncertainty.',
      addsSections: ['risk_matrix'],
      addsAgents: ['critic-agent'],
      addsValidationGates: ['logic_check'],
      complexityWeight: 1,
    }),
    option({
      id: 'validation:strict-gates',
      category: 'validation',
      label: 'Strict validation gates',
      description: 'Require blocking validation gates before completion.',
      addsSections: ['validation_plan'],
      addsAgents: ['verifier-agent'],
      addsValidationGates: ['schema', 'logic_check', 'security_check'],
      complexityWeight: 2,
    }),
  ],
});

export const OPTION_GRAPH_FIXTURES: readonly OptionGraphFixture[] = [
  OptionGraphFixtureSchema.parse({
    id: 'product-spec',
    label: 'Product spec',
    rawIntent: 'Create an implementation-ready product spec for a new workbench feature',
    modeId: 'spec',
    permissionMode: 'safe',
    selectedOptionIds: [
      'output:prd',
      'depth:implementation-ready',
      'audience:executive',
      'deliverable:tasks',
      'validation:strict-gates',
    ],
  }),
  OptionGraphFixtureSchema.parse({
    id: 'code-task',
    label: 'Code task',
    rawIntent: 'Build a tested API integration with official documentation',
    modeId: 'build',
    permissionMode: 'ask',
    selectedOptionIds: ['output:task-pack', 'audience:developer', 'tdd:test-first', 'testing:unit-integration', 'api:official-docs'],
  }),
  OptionGraphFixtureSchema.parse({
    id: 'market-research',
    label: 'Market research',
    rawIntent: 'Prepare current market research with primary sources for executive buyers',
    modeId: 'research',
    permissionMode: 'safe',
    selectedOptionIds: [
      'research:research-grade',
      'sources:primary-sources',
      'recency:current',
      'audience:executive',
      'format:markdown',
      'metrics:success',
      'risk:matrix',
    ],
  }),
  OptionGraphFixtureSchema.parse({
    id: 'presentation-review',
    label: 'Presentation review',
    rawIntent: 'Review this board presentation for executive clarity and visual quality',
    modeId: 'review',
    permissionMode: 'safe',
    selectedOptionIds: ['output:review-report', 'design:visual-critique', 'audience:executive', 'validation:strict-gates'],
  }),
  OptionGraphFixtureSchema.parse({
    id: 'prompt-rewrite',
    label: 'Prompt rewrite',
    rawIntent: 'Rewrite this raw prompt into a concise build-ready prompt',
    modeId: 'rewrite',
    permissionMode: 'safe',
    selectedOptionIds: ['style:concise', 'format:markdown', 'depth:implementation-ready'],
  }),
] as const;

function uniquePreserveOrder<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

function buildOptionMap(graph: OptionGraph): Map<string, OptionGraphOption> {
  return new Map(graph.options.map((graphOption) => [graphOption.id, graphOption]));
}

function parseGraph(graph: OptionGraph = DEFAULT_OPTION_GRAPH): OptionGraph {
  return OptionGraphSchema.parse(graph);
}

export function validateOptionGraph(graph: OptionGraph = DEFAULT_OPTION_GRAPH): OptionGraphValidationResult {
  const parsedGraph = parseGraph(graph);
  const seen = new Set<string>();

  for (const graphOption of parsedGraph.options) {
    if (seen.has(graphOption.id)) {
      throw new Error(`Duplicate option id ${graphOption.id}`);
    }
    seen.add(graphOption.id);
  }

  for (const graphOption of parsedGraph.options) {
    for (const requiredOptionId of graphOption.requires) {
      if (!seen.has(requiredOptionId)) {
        throw new Error(`Option ${graphOption.id} requires unknown option ${requiredOptionId}`);
      }
    }

    for (const excludedOptionId of graphOption.excludes) {
      if (!seen.has(excludedOptionId)) {
        throw new Error(`Option ${graphOption.id} excludes unknown option ${excludedOptionId}`);
      }
    }
  }

  return {
    graphId: parsedGraph.id,
    optionCount: parsedGraph.options.length,
    categories: uniquePreserveOrder(parsedGraph.options.map((graphOption) => graphOption.category)),
  };
}

function collectSelectedOptions(graph: OptionGraph, selectedOptionIds: readonly string[]): OptionGraphOption[] {
  const optionMap = buildOptionMap(graph);
  const selectedOptions: OptionGraphOption[] = [];

  for (const optionId of selectedOptionIds) {
    const selectedOption = optionMap.get(optionId);
    if (!selectedOption) {
      throw new Error(`Unknown option ${optionId}`);
    }
    selectedOptions.push(selectedOption);
  }

  return selectedOptions;
}

function assertSelectionIsValid(selectedOptions: readonly OptionGraphOption[], selectedOptionIds: readonly string[]): void {
  const selectedSet = new Set(selectedOptionIds);

  for (const selectedOption of selectedOptions) {
    for (const requiredOptionId of selectedOption.requires) {
      if (!selectedSet.has(requiredOptionId)) {
        throw new Error(`Option ${selectedOption.id} requires ${requiredOptionId}`);
      }
    }

    for (const excludedOptionId of selectedOption.excludes) {
      if (selectedSet.has(excludedOptionId)) {
        throw new Error(`Option ${selectedOption.id} excludes ${excludedOptionId}`);
      }
    }
  }
}

function conditionMatches(
  condition: OptionGraphCondition,
  rawIntent: string,
  modeId: ProductMode | undefined,
  selectedSet: ReadonlySet<string>,
): boolean {
  if (condition.modeIds.length > 0 && (!modeId || !condition.modeIds.includes(modeId))) {
    return false;
  }

  if (condition.rawIntentIncludes.length > 0) {
    const normalizedRawIntent = rawIntent.toLowerCase();
    if (!condition.rawIntentIncludes.some((needle) => normalizedRawIntent.includes(needle.toLowerCase()))) {
      return false;
    }
  }

  if (condition.selectedOptionIds.length > 0 && !condition.selectedOptionIds.every((optionId) => selectedSet.has(optionId))) {
    return false;
  }

  return true;
}

function optionApplies(
  graphOption: OptionGraphOption,
  rawIntent: string,
  modeId: ProductMode | undefined,
  selectedSet: ReadonlySet<string>,
): boolean {
  if (graphOption.appliesWhen.length === 0) {
    return true;
  }

  return graphOption.appliesWhen.some((condition) => conditionMatches(condition, rawIntent, modeId, selectedSet));
}

export function resolveOptionGraphOptions(input: ResolveOptionGraphOptionsInput): ResolveOptionGraphOptionsResult {
  const graph = parseGraph(input.graph);
  validateOptionGraph(graph);

  const selectedOptionIds = uniquePreserveOrder(input.selectedOptionIds ?? []);
  const selectedSet = new Set(selectedOptionIds);
  const selectedOptions = collectSelectedOptions(graph, selectedOptionIds);
  const excludedBySelection = new Set(selectedOptions.flatMap((graphOption) => graphOption.excludes));

  const availableOptions = graph.options.filter((graphOption) => {
    if (!selectedSet.has(graphOption.id) && excludedBySelection.has(graphOption.id)) {
      return false;
    }

    if (!selectedSet.has(graphOption.id) && !graphOption.requires.every((optionId) => selectedSet.has(optionId))) {
      return false;
    }

    return optionApplies(graphOption, input.rawIntent, input.modeId, selectedSet);
  });

  return {
    graph,
    availableOptions,
    availableOptionIds: availableOptions.map((graphOption) => graphOption.id),
  };
}

export function resolveOptionGraphExecutionConfig(
  input: ResolveOptionGraphExecutionConfigInput,
): ResolvedOptionGraphExecutionConfig {
  const graph = parseGraph(input.graph);
  validateOptionGraph(graph);

  const selectedOptionIds = uniquePreserveOrder(input.selectedOptionIds);
  const selectedOptions = collectSelectedOptions(graph, selectedOptionIds);
  assertSelectionIsValid(selectedOptions, selectedOptionIds);

  const selectedSkills = uniquePreserveOrder(selectedOptions.flatMap((graphOption) => graphOption.addsSkills)) as WorkbenchBundleSkillSlug[];
  const selectedAgents = uniquePreserveOrder(selectedOptions.flatMap((graphOption) => graphOption.addsAgents));
  const selectedValidationGates = uniquePreserveOrder(selectedOptions.flatMap((graphOption) => graphOption.addsValidationGates));

  const modeConfig = resolveProductModeExecutionConfig({
    modeId: input.modeId,
    permissionMode: input.permissionMode,
    selectedSkills,
    selectedAgents,
    selectedValidationGates,
  });

  const outputArtifactTypes = uniquePreserveOrder([
    ...modeConfig.outputArtifactTypes,
    ...selectedOptions.flatMap((graphOption) => graphOption.addsArtifactTypes),
  ]);

  return {
    graph,
    modeConfig,
    selectedOptions,
    selectedOptionIds,
    sections: uniquePreserveOrder(selectedOptions.flatMap((graphOption) => graphOption.addsSections)),
    skills: modeConfig.skills,
    agents: modeConfig.agents,
    validationGates: modeConfig.validationGates,
    outputArtifactTypes,
    complexityWeight: selectedOptions.reduce((sum, graphOption) => sum + graphOption.complexityWeight, 0),
  };
}

export function getOptionGraphFixture(fixtureId: OptionGraphFixtureId): OptionGraphFixture {
  const fixture = OPTION_GRAPH_FIXTURES.find((candidate) => candidate.id === fixtureId);
  if (!fixture) {
    throw new Error(`Unknown option graph fixture ${fixtureId}`);
  }
  return OptionGraphFixtureSchema.parse(fixture);
}
