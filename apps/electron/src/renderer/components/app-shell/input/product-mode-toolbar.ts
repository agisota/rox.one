import type { ProductMode } from '@rox-agent/shared/workbench/product-mode-registry';

export type { ProductMode };

export const PRODUCT_MODE_TOOLBAR_DEFAULT_MODE = 'research' satisfies ProductMode;

const COMPOSER_PRODUCT_MODE_IDS = [
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
] as const satisfies readonly ProductMode[];

export const COMPOSER_PRODUCT_MODE_ACTION_IDS = [
  'improve-prompt',
  'run-tdd-plan',
  'verify',
  'tear-down',
  'build-spec',
  'review',
] as const;

export type ComposerProductModeActionId = typeof COMPOSER_PRODUCT_MODE_ACTION_IDS[number];

export type ProductModeIntentSource = 'composer-toolbar';

export type ProductModeIntent = {
  type: 'product-mode-intent';
  source: ProductModeIntentSource;
  actionId: ComposerProductModeActionId;
  mode: ProductMode;
  labelKey: string;
};

export type ComposerProductModeAction = {
  id: ComposerProductModeActionId;
  labelKey: string;
  descriptionKey: string;
  ariaLabelKey: string;
  mode: ProductMode | 'selected';
};

export type ComposerProductModeOption = {
  id: ProductMode;
  labelKey: string;
  descriptionKey: string;
};

const COMPOSER_PRODUCT_MODE_ACTIONS: readonly ComposerProductModeAction[] = [
  {
    id: 'improve-prompt',
    labelKey: 'workbench.actions.improvePrompt',
    descriptionKey: 'workbench.actions.improvePrompt.description',
    ariaLabelKey: 'workbench.actions.improvePrompt',
    mode: 'rewrite',
  },
  {
    id: 'run-tdd-plan',
    labelKey: 'workbench.actions.runTddPlan',
    descriptionKey: 'workbench.actions.runTddPlan.description',
    ariaLabelKey: 'workbench.actions.runTddPlan',
    mode: 'tdd',
  },
  {
    id: 'verify',
    labelKey: 'workbench.actions.verify',
    descriptionKey: 'workbench.actions.verify.description',
    ariaLabelKey: 'workbench.actions.verify',
    mode: 'verify',
  },
  {
    id: 'tear-down',
    labelKey: 'workbench.actions.tearDown',
    descriptionKey: 'workbench.actions.tearDown.description',
    ariaLabelKey: 'workbench.actions.tearDown',
    mode: 'review',
  },
  {
    id: 'build-spec',
    labelKey: 'workbench.actions.buildSpec',
    descriptionKey: 'workbench.actions.buildSpec.description',
    ariaLabelKey: 'workbench.actions.buildSpec',
    mode: 'spec',
  },
  {
    id: 'review',
    labelKey: 'workbench.actions.review',
    descriptionKey: 'workbench.actions.review.description',
    ariaLabelKey: 'workbench.actions.review',
    mode: 'review',
  },
] as const;

export function getComposerProductModeActions(): readonly ComposerProductModeAction[] {
  return COMPOSER_PRODUCT_MODE_ACTIONS;
}

export function getComposerProductModeOptions(): ComposerProductModeOption[] {
  return COMPOSER_PRODUCT_MODE_IDS.map(id => ({
    id,
    labelKey: `workbench.modes.${id}.label`,
    descriptionKey: `workbench.modes.${id}.description`,
  }));
}

export function resolveComposerProductModeFromAction(
  actionId: ComposerProductModeActionId,
  selectedMode: ProductMode,
): ProductMode {
  const action = COMPOSER_PRODUCT_MODE_ACTIONS.find(candidate => candidate.id === actionId);

  if (!action) {
    return selectedMode;
  }

  return action.mode === 'selected' ? selectedMode : action.mode;
}

export function createProductModeIntent(
  actionId: ComposerProductModeActionId,
  selectedMode: ProductMode,
): ProductModeIntent {
  const action = COMPOSER_PRODUCT_MODE_ACTIONS.find(candidate => candidate.id === actionId);

  if (!action) {
    throw new Error(`Unknown composer product mode action: ${actionId}`);
  }

  return {
    type: 'product-mode-intent',
    source: 'composer-toolbar',
    actionId,
    mode: resolveComposerProductModeFromAction(actionId, selectedMode),
    labelKey: action.labelKey,
  };
}
