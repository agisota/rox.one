import { z } from 'zod';
import type { PermissionMode } from '../agent/mode-types';
import type { WorkbenchBundleSkillSlug } from './bundle-types';

export const PRODUCT_MODE_IDS = [
  'rewrite',
  'think',
  'spec',
  'plan',
  'build',
  'review',
  'verify',
  'board',
  'tdd',
  'research',
] as const;

export const ProductModeSchema = z.enum(PRODUCT_MODE_IDS);
export type ProductMode = z.infer<typeof ProductModeSchema>;

export const ValidationGateSchema = z.enum([
  'schema',
  'unit_tests',
  'integration_tests',
  'ui_tests',
  'e2e_tests',
  'fact_check',
  'logic_check',
  'brand_check',
  'security_check',
  'rbac_check',
  'quota_check',
  'sync_check',
] as const);
export type ValidationGate = z.infer<typeof ValidationGateSchema>;

export const ArtifactTypeSchema = z.enum([
  'prompt',
  'spec',
  'prd',
  'tasks',
  'code',
  'report',
  'review',
  'file',
  'entity_graph',
] as const);
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;

export const ProductAgentRoleSchema = z.enum([
  'intake-agent',
  'clarifier-agent',
  'spec-writer-agent',
  'planner-agent',
  'research-agent',
  'builder-agent',
  'test-agent',
  'critic-agent',
  'verifier-agent',
  'synthesizer-agent',
] as const);
export type ProductAgentRole = z.infer<typeof ProductAgentRoleSchema>;

export interface ProductModePanelConfig {
  primaryActionKey: string;
  secondaryActionKeys: string[];
  showOptionGraph: boolean;
  showValidationGates: boolean;
  showPipelinePreview: boolean;
}

export interface ProductModeDefinition {
  id: ProductMode;
  labelKey: string;
  descriptionKey: string;
  iconKey: string;
  defaultSkills: WorkbenchBundleSkillSlug[];
  defaultAgents: ProductAgentRole[];
  allowedPermissionModes: PermissionMode[];
  defaultValidationGates: ValidationGate[];
  uiPanelConfig: ProductModePanelConfig;
  outputArtifactTypes: ArtifactType[];
}

export interface ResolveProductModeExecutionConfigInput {
  modeId: ProductMode;
  permissionMode: PermissionMode;
  selectedSkills?: WorkbenchBundleSkillSlug[];
  selectedAgents?: ProductAgentRole[];
  selectedValidationGates?: ValidationGate[];
}

export interface ResolvedProductModeExecutionConfig {
  mode: ProductModeDefinition;
  permissionMode: PermissionMode;
  skills: WorkbenchBundleSkillSlug[];
  agents: ProductAgentRole[];
  validationGates: ValidationGate[];
  outputArtifactTypes: ArtifactType[];
  uiPanelConfig: ProductModePanelConfig;
}

function modeKeys(mode: ProductMode): Pick<ProductModeDefinition, 'labelKey' | 'descriptionKey'> {
  return {
    labelKey: `workbench.modes.${mode}.label`,
    descriptionKey: `workbench.modes.${mode}.description`,
  };
}

function panelConfig(
  primaryActionKey: string,
  overrides: Partial<ProductModePanelConfig> = {},
): ProductModePanelConfig {
  return {
    primaryActionKey,
    secondaryActionKeys: [],
    showOptionGraph: false,
    showValidationGates: true,
    showPipelinePreview: false,
    ...overrides,
  };
}

const PRODUCT_MODE_REGISTRY: ProductModeDefinition[] = [
  {
    id: 'rewrite',
    ...modeKeys('rewrite'),
    iconKey: 'wand',
    defaultSkills: ['prompt-rewriter-pack'],
    defaultAgents: ['intake-agent', 'spec-writer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'logic_check', 'brand_check'],
    uiPanelConfig: panelConfig('workbench.actions.rewritePrompt'),
    outputArtifactTypes: ['prompt'],
  },
  {
    id: 'think',
    ...modeKeys('think'),
    iconKey: 'brain',
    defaultSkills: ['thinking-partner-pack'],
    defaultAgents: ['clarifier-agent', 'critic-agent', 'synthesizer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'logic_check'],
    uiPanelConfig: panelConfig('workbench.actions.thinkWithMe', {
      showOptionGraph: true,
    }),
    outputArtifactTypes: ['spec'],
  },
  {
    id: 'spec',
    ...modeKeys('spec'),
    iconKey: 'list-checks',
    defaultSkills: ['spec-builder-pack'],
    defaultAgents: ['clarifier-agent', 'spec-writer-agent', 'planner-agent', 'verifier-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'logic_check', 'brand_check'],
    uiPanelConfig: panelConfig('workbench.actions.buildSpec', {
      showOptionGraph: true,
      showPipelinePreview: true,
    }),
    outputArtifactTypes: ['spec', 'prd', 'tasks'],
  },
  {
    id: 'plan',
    ...modeKeys('plan'),
    iconKey: 'network',
    defaultSkills: ['multi-agent-planning-pack'],
    defaultAgents: ['planner-agent', 'critic-agent', 'synthesizer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'logic_check'],
    uiPanelConfig: panelConfig('workbench.actions.startAgentPlan', {
      showPipelinePreview: true,
    }),
    outputArtifactTypes: ['tasks'],
  },
  {
    id: 'build',
    ...modeKeys('build'),
    iconKey: 'hammer',
    defaultSkills: ['multi-agent-planning-pack', 'tdd-qa-verification-pack'],
    defaultAgents: ['planner-agent', 'builder-agent', 'test-agent', 'critic-agent', 'verifier-agent'],
    allowedPermissionModes: ['ask', 'allow-all'],
    defaultValidationGates: ['schema', 'unit_tests', 'integration_tests', 'logic_check'],
    uiPanelConfig: panelConfig('workbench.actions.startBuild', {
      showPipelinePreview: true,
    }),
    outputArtifactTypes: ['code', 'tasks'],
  },
  {
    id: 'review',
    ...modeKeys('review'),
    iconKey: 'shield-check',
    defaultSkills: ['review-board-pack'],
    defaultAgents: ['critic-agent', 'verifier-agent', 'synthesizer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'logic_check', 'fact_check', 'brand_check', 'security_check'],
    uiPanelConfig: panelConfig('workbench.actions.review', {
      showPipelinePreview: true,
    }),
    outputArtifactTypes: ['review', 'report'],
  },
  {
    id: 'verify',
    ...modeKeys('verify'),
    iconKey: 'badge-check',
    defaultSkills: ['tdd-qa-verification-pack', 'security-compliance-pack'],
    defaultAgents: ['test-agent', 'verifier-agent', 'synthesizer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'unit_tests', 'integration_tests', 'ui_tests', 'e2e_tests', 'security_check'],
    uiPanelConfig: panelConfig('workbench.actions.verify'),
    outputArtifactTypes: ['review', 'report'],
  },
  {
    id: 'board',
    ...modeKeys('board'),
    iconKey: 'layout-dashboard',
    defaultSkills: ['review-board-pack', 'multi-agent-planning-pack'],
    defaultAgents: ['planner-agent', 'critic-agent', 'verifier-agent', 'synthesizer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'logic_check', 'fact_check'],
    uiPanelConfig: panelConfig('workbench.actions.openBoard', {
      showOptionGraph: true,
      showPipelinePreview: true,
    }),
    outputArtifactTypes: ['review', 'tasks'],
  },
  {
    id: 'tdd',
    ...modeKeys('tdd'),
    iconKey: 'test-tube',
    defaultSkills: ['tdd-qa-verification-pack'],
    defaultAgents: ['planner-agent', 'test-agent', 'verifier-agent'],
    allowedPermissionModes: ['safe', 'ask', 'allow-all'],
    defaultValidationGates: ['schema', 'unit_tests', 'integration_tests', 'ui_tests', 'e2e_tests'],
    uiPanelConfig: panelConfig('workbench.actions.runTddPlan', {
      showPipelinePreview: true,
    }),
    outputArtifactTypes: ['tasks'],
  },
  {
    id: 'research',
    ...modeKeys('research'),
    iconKey: 'search',
    defaultSkills: ['research-fact-check-pack'],
    defaultAgents: ['research-agent', 'verifier-agent', 'synthesizer-agent'],
    allowedPermissionModes: ['safe', 'ask'],
    defaultValidationGates: ['schema', 'fact_check', 'logic_check'],
    uiPanelConfig: panelConfig('workbench.actions.startResearch', {
      showOptionGraph: true,
    }),
    outputArtifactTypes: ['report', 'file'],
  },
];

function copyMode(mode: ProductModeDefinition): ProductModeDefinition {
  return {
    ...mode,
    defaultSkills: [...mode.defaultSkills],
    defaultAgents: [...mode.defaultAgents],
    allowedPermissionModes: [...mode.allowedPermissionModes],
    defaultValidationGates: [...mode.defaultValidationGates],
    outputArtifactTypes: [...mode.outputArtifactTypes],
    uiPanelConfig: {
      ...mode.uiPanelConfig,
      secondaryActionKeys: [...mode.uiPanelConfig.secondaryActionKeys],
    },
  };
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function getProductModeRegistry(): ProductModeDefinition[] {
  return PRODUCT_MODE_REGISTRY.map(copyMode);
}

export function getProductMode(modeId: ProductMode): ProductModeDefinition {
  const mode = PRODUCT_MODE_REGISTRY.find((entry) => entry.id === modeId);
  if (!mode) {
    throw new Error(`Unknown product mode: ${modeId}`);
  }

  return copyMode(mode);
}

export function isPermissionModeAllowedForProductMode(modeId: ProductMode, permissionMode: PermissionMode): boolean {
  return getProductMode(modeId).allowedPermissionModes.includes(permissionMode);
}

export function resolveProductModeExecutionConfig(
  input: ResolveProductModeExecutionConfigInput,
): ResolvedProductModeExecutionConfig {
  const mode = getProductMode(input.modeId);

  if (!mode.allowedPermissionModes.includes(input.permissionMode)) {
    throw new Error(`Product mode ${input.modeId} is not compatible with permission mode ${input.permissionMode}`);
  }

  return {
    mode,
    permissionMode: input.permissionMode,
    skills: unique([...mode.defaultSkills, ...(input.selectedSkills ?? [])]),
    agents: unique([...mode.defaultAgents, ...(input.selectedAgents ?? [])]),
    validationGates: unique([...mode.defaultValidationGates, ...(input.selectedValidationGates ?? [])]),
    outputArtifactTypes: [...mode.outputArtifactTypes],
    uiPanelConfig: {
      ...mode.uiPanelConfig,
      secondaryActionKeys: [...mode.uiPanelConfig.secondaryActionKeys],
    },
  };
}
