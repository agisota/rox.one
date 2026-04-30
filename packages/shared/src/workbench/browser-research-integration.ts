import type { PermissionMode } from '../agent/mode-types';
import type { ProductMode, ValidationGate } from './product-mode-registry';
import { getProductMode } from './product-mode-registry';

export const BROWSER_RESEARCH_TOOL_IDS = ['web_search', 'web_fetch', 'browser_tool'] as const;
export type BrowserResearchToolId = typeof BROWSER_RESEARCH_TOOL_IDS[number];

export const BROWSER_RESEARCH_SUPPORTED_MODE_IDS = ['research', 'review', 'board'] as const satisfies readonly ProductMode[];
export type BrowserResearchSupportedModeId = typeof BROWSER_RESEARCH_SUPPORTED_MODE_IDS[number];

export interface DisabledBrowserResearchTool {
  toolId: BrowserResearchToolId;
  reason: string;
}

export interface ResolveBrowserResearchIntegrationInput {
  modeId: ProductMode;
  permissionMode: PermissionMode;
  validationGates: ValidationGate[];
  requestedTools?: BrowserResearchToolId[];
}

export interface BrowserResearchIntegrationConfig {
  modeId: ProductMode;
  permissionMode: PermissionMode;
  enabledTools: BrowserResearchToolId[];
  disabledTools: DisabledBrowserResearchTool[];
  requiredValidationGates: ValidationGate[];
  requiresUserPermission: boolean;
  policySummary: string;
}

const REQUIRED_VALIDATION_GATES: ValidationGate[] = ['fact_check'];

function uniqueRequestedTools(requestedTools?: BrowserResearchToolId[]): BrowserResearchToolId[] {
  if (!requestedTools?.length) {
    return [...BROWSER_RESEARCH_TOOL_IDS];
  }

  const requested = new Set(requestedTools);
  return BROWSER_RESEARCH_TOOL_IDS.filter((toolId) => requested.has(toolId));
}

function disabledAll(tools: BrowserResearchToolId[], reason: string): DisabledBrowserResearchTool[] {
  return tools.map((toolId) => ({ toolId, reason }));
}

function isSupportedMode(modeId: ProductMode): modeId is BrowserResearchSupportedModeId {
  return BROWSER_RESEARCH_SUPPORTED_MODE_IDS.includes(modeId as BrowserResearchSupportedModeId);
}

export function resolveBrowserResearchIntegration(
  input: ResolveBrowserResearchIntegrationInput,
): BrowserResearchIntegrationConfig {
  const requestedTools = uniqueRequestedTools(input.requestedTools);
  const mode = getProductMode(input.modeId);

  if (!isSupportedMode(input.modeId)) {
    return {
      modeId: input.modeId,
      permissionMode: input.permissionMode,
      enabledTools: [],
      disabledTools: disabledAll(requestedTools, `product mode ${input.modeId} does not support browser research tools`),
      requiredValidationGates: [...REQUIRED_VALIDATION_GATES],
      requiresUserPermission: false,
      policySummary: `browser research disabled for unsupported mode ${input.modeId}`,
    };
  }

  if (!mode.allowedPermissionModes.includes(input.permissionMode)) {
    return {
      modeId: input.modeId,
      permissionMode: input.permissionMode,
      enabledTools: [],
      disabledTools: disabledAll(requestedTools, `permission mode ${input.permissionMode} is not allowed for ${input.modeId}`),
      requiredValidationGates: [...REQUIRED_VALIDATION_GATES],
      requiresUserPermission: false,
      policySummary: `browser research disabled for ${input.modeId} in ${input.permissionMode}`,
    };
  }

  const hasRequiredGate = REQUIRED_VALIDATION_GATES.every((gate) => input.validationGates.includes(gate));
  if (!hasRequiredGate) {
    return {
      modeId: input.modeId,
      permissionMode: input.permissionMode,
      enabledTools: [],
      disabledTools: disabledAll(requestedTools, 'missing required validation gate: fact_check'),
      requiredValidationGates: [...REQUIRED_VALIDATION_GATES],
      requiresUserPermission: false,
      policySummary: `browser research disabled for ${input.modeId}; missing fact_check gate`,
    };
  }

  const enabledTools: BrowserResearchToolId[] = [];
  const disabledTools: DisabledBrowserResearchTool[] = [];

  for (const toolId of requestedTools) {
    if (toolId === 'browser_tool' && input.permissionMode !== 'ask') {
      disabledTools.push({
        toolId,
        reason: 'browser_tool requires ask permission mode for interactive browser research',
      });
      continue;
    }

    enabledTools.push(toolId);
  }

  return {
    modeId: input.modeId,
    permissionMode: input.permissionMode,
    enabledTools,
    disabledTools,
    requiredValidationGates: [...REQUIRED_VALIDATION_GATES],
    requiresUserPermission: enabledTools.includes('browser_tool'),
    policySummary: enabledTools.length
      ? `browser research enabled for ${input.modeId} with fact_check gate`
      : `browser research disabled for ${input.modeId}`,
  };
}
