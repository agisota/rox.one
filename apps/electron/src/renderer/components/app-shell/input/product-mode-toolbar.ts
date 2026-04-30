import type { ProductMode } from '@rox-agent/shared/workbench/product-mode-registry';

export type { ProductMode };

export const PRODUCT_MODE_TOOLBAR_DEFAULT_MODE = 'rewrite' satisfies ProductMode;

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
  'rewrite-prompt',
  'think-with-me',
  'build-spec',
  'review',
  'verify',
  'run-tdd-plan',
  'save-preset',
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
    id: 'rewrite-prompt',
    labelKey: 'workbench.actions.rewritePrompt',
    ariaLabelKey: 'workbench.actions.rewritePrompt',
    mode: 'rewrite',
  },
  {
    id: 'think-with-me',
    labelKey: 'workbench.actions.thinkWithMe',
    ariaLabelKey: 'workbench.actions.thinkWithMe',
    mode: 'think',
  },
  {
    id: 'build-spec',
    labelKey: 'workbench.actions.buildSpec',
    ariaLabelKey: 'workbench.actions.buildSpec',
    mode: 'spec',
  },
  {
    id: 'review',
    labelKey: 'workbench.actions.review',
    ariaLabelKey: 'workbench.actions.review',
    mode: 'review',
  },
  {
    id: 'verify',
    labelKey: 'workbench.actions.verify',
    ariaLabelKey: 'workbench.actions.verify',
    mode: 'verify',
  },
  {
    id: 'run-tdd-plan',
    labelKey: 'workbench.actions.runTddPlan',
    ariaLabelKey: 'workbench.actions.runTddPlan',
    mode: 'tdd',
  },
  {
    id: 'save-preset',
    labelKey: 'workbench.actions.savePreset',
    ariaLabelKey: 'workbench.actions.savePreset',
    mode: 'selected',
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
