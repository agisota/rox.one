import type { ProductMode } from '@rox-one/shared/workbench/product-mode-registry';

export type { ProductMode };

export const PRODUCT_MODE_TOOLBAR_DEFAULT_MODE = 'research' satisfies ProductMode;

export const COMPOSER_PRODUCT_MODE_NAVIGATION_KEYS = [
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
] as const;

export type ComposerProductModeNavigationKey = typeof COMPOSER_PRODUCT_MODE_NAVIGATION_KEYS[number];

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
export type ComposerQuickActionWrapperId =
  | 'improve-prompt'
  | 'tdd-plan'
  | 'verify'
  | 'tear-down'
  | 'spec'
  | 'review';

export type ComposerProductModeArtifactKind = 'prompt-lab' | 'tdd-plan' | 'review-gate' | 'spec-builder';

export const COMPOSER_PRODUCT_MODE_PRIMARY_ACTION_IDS = [
  'improve-prompt',
  'run-tdd-plan',
  'verify',
] as const satisfies readonly ComposerProductModeActionId[];

export const COMPOSER_PRODUCT_MODE_OVERFLOW_ACTION_IDS = [
  'tear-down',
  'build-spec',
  'review',
] as const satisfies readonly ComposerProductModeActionId[];

export type ProductModeIntentSource = 'composer-toolbar' | 'composer-artifact-panel';

export type ProductModeIntent = {
  type: 'product-mode-intent';
  source: ProductModeIntentSource;
  behavior: 'wrap-prompt' | 'open-artifact';
  actionId: ComposerProductModeActionId;
  artifactKind?: ComposerProductModeArtifactKind;
  wrapperId?: ComposerQuickActionWrapperId;
  mode: ProductMode;
  labelKey: string;
};

export type ComposerProductModeAction = {
  id: ComposerProductModeActionId;
  labelKey: string;
  descriptionKey: string;
  ariaLabelKey: string;
  mode: ProductMode | 'selected';
  wrapperId: ComposerQuickActionWrapperId;
  artifactKind: ComposerProductModeArtifactKind;
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
    wrapperId: 'improve-prompt',
    artifactKind: 'prompt-lab',
  },
  {
    id: 'run-tdd-plan',
    labelKey: 'workbench.actions.runTddPlan',
    descriptionKey: 'workbench.actions.runTddPlan.description',
    ariaLabelKey: 'workbench.actions.runTddPlan',
    mode: 'tdd',
    wrapperId: 'tdd-plan',
    artifactKind: 'tdd-plan',
  },
  {
    id: 'verify',
    labelKey: 'workbench.actions.verify',
    descriptionKey: 'workbench.actions.verify.description',
    ariaLabelKey: 'workbench.actions.verify',
    mode: 'verify',
    wrapperId: 'verify',
    artifactKind: 'review-gate',
  },
  {
    id: 'tear-down',
    labelKey: 'workbench.actions.tearDown',
    descriptionKey: 'workbench.actions.tearDown.description',
    ariaLabelKey: 'workbench.actions.tearDown',
    mode: 'review',
    wrapperId: 'tear-down',
    artifactKind: 'review-gate',
  },
  {
    id: 'build-spec',
    labelKey: 'workbench.actions.buildSpec',
    descriptionKey: 'workbench.actions.buildSpec.description',
    ariaLabelKey: 'workbench.actions.buildSpec',
    mode: 'spec',
    wrapperId: 'spec',
    artifactKind: 'spec-builder',
  },
  {
    id: 'review',
    labelKey: 'workbench.actions.review',
    descriptionKey: 'workbench.actions.review.description',
    ariaLabelKey: 'workbench.actions.review',
    mode: 'review',
    wrapperId: 'review',
    artifactKind: 'review-gate',
  },
] as const;

export function getComposerProductModeActions(): readonly ComposerProductModeAction[] {
  return COMPOSER_PRODUCT_MODE_ACTIONS;
}

function getComposerProductModeActionsById(
  actionIds: readonly ComposerProductModeActionId[],
): readonly ComposerProductModeAction[] {
  return actionIds.map(actionId => {
    const action = COMPOSER_PRODUCT_MODE_ACTIONS.find(candidate => candidate.id === actionId);

    if (!action) {
      throw new Error(`Unknown composer product mode action: ${actionId}`);
    }

    return action;
  });
}

export function getComposerProductModePrimaryActions(): readonly ComposerProductModeAction[] {
  return getComposerProductModeActionsById(COMPOSER_PRODUCT_MODE_PRIMARY_ACTION_IDS);
}

export function getComposerProductModeOverflowActions(): readonly ComposerProductModeAction[] {
  return getComposerProductModeActionsById(COMPOSER_PRODUCT_MODE_OVERFLOW_ACTION_IDS);
}

export function getComposerProductModeOptions(): ComposerProductModeOption[] {
  return COMPOSER_PRODUCT_MODE_IDS.map(id => ({
    id,
    labelKey: `workbench.modes.${id}.label`,
    descriptionKey: `workbench.modes.${id}.description`,
  }));
}

export function isComposerProductModeNavigationKey(key: string): key is ComposerProductModeNavigationKey {
  return COMPOSER_PRODUCT_MODE_NAVIGATION_KEYS.some(candidate => candidate === key);
}

export function resolveComposerProductModeKeyboardTarget(
  currentMode: ProductMode,
  key: ComposerProductModeNavigationKey,
): ProductMode {
  const currentIndex = COMPOSER_PRODUCT_MODE_IDS.indexOf(currentMode);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;

  switch (key) {
    case 'ArrowDown':
      return COMPOSER_PRODUCT_MODE_IDS[(safeIndex + 1) % COMPOSER_PRODUCT_MODE_IDS.length];
    case 'ArrowUp':
      return COMPOSER_PRODUCT_MODE_IDS[
        (safeIndex - 1 + COMPOSER_PRODUCT_MODE_IDS.length) % COMPOSER_PRODUCT_MODE_IDS.length
      ];
    case 'Home':
      return COMPOSER_PRODUCT_MODE_IDS[0];
    case 'End':
      return COMPOSER_PRODUCT_MODE_IDS[COMPOSER_PRODUCT_MODE_IDS.length - 1];
  }
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
    behavior: 'wrap-prompt',
    actionId,
    artifactKind: action.artifactKind,
    wrapperId: action.wrapperId,
    mode: resolveComposerProductModeFromAction(actionId, selectedMode),
    labelKey: action.labelKey,
  };
}

export function createOpenArtifactProductModeIntent(
  artifactKind: ComposerProductModeArtifactKind,
  selectedMode: ProductMode,
  options: {
    actionId?: ComposerProductModeActionId;
    source?: ProductModeIntentSource;
  } = {},
): ProductModeIntent {
  const fallbackActionIdByKind: Record<ComposerProductModeArtifactKind, ComposerProductModeActionId> = {
    'prompt-lab': 'improve-prompt',
    'tdd-plan': 'run-tdd-plan',
    'review-gate': 'review',
    'spec-builder': 'build-spec',
  };
  const actionId = options.actionId ?? fallbackActionIdByKind[artifactKind];
  const action = COMPOSER_PRODUCT_MODE_ACTIONS.find(candidate => candidate.id === actionId);

  if (!action) {
    throw new Error(`Unknown composer product mode action: ${actionId}`);
  }

  return {
    type: 'product-mode-intent',
    source: options.source ?? 'composer-artifact-panel',
    behavior: 'open-artifact',
    actionId,
    artifactKind,
    wrapperId: action.wrapperId,
    mode: resolveComposerProductModeFromAction(actionId, selectedMode),
    labelKey: action.labelKey,
  };
}
