import { describe, expect, test } from 'bun:test';

import {
  COMPOSER_PRODUCT_MODE_ACTION_IDS,
  PRODUCT_MODE_TOOLBAR_DEFAULT_MODE,
  createProductModeIntent,
  getComposerProductModeActions,
  getComposerProductModeOptions,
  resolveComposerProductModeFromAction,
  type ComposerProductModeActionId,
  type ProductMode,
} from '../product-mode-toolbar';

const REQUIRED_ACTIONS: Array<[ComposerProductModeActionId, ProductMode]> = [
  ['rewrite-prompt', 'rewrite'],
  ['think-with-me', 'think'],
  ['build-spec', 'spec'],
  ['review', 'review'],
  ['verify', 'verify'],
  ['run-tdd-plan', 'tdd'],
  ['save-preset', 'review'],
];

describe('product mode toolbar contract', () => {
  test('declares the default product mode for the composer', () => {
    expect(PRODUCT_MODE_TOOLBAR_DEFAULT_MODE).toBe('rewrite');
  });

  test('renders the required composer action order', () => {
    expect([...COMPOSER_PRODUCT_MODE_ACTION_IDS]).toEqual(REQUIRED_ACTIONS.map(([actionId]) => actionId));
    expect(getComposerProductModeActions().map(action => action.id)).toEqual([...COMPOSER_PRODUCT_MODE_ACTION_IDS]);
  });

  test('maps every action to the expected product mode', () => {
    for (const [actionId, expectedMode] of REQUIRED_ACTIONS) {
      expect(resolveComposerProductModeFromAction(actionId, 'review')).toBe(expectedMode);
    }
  });

  test('keeps save-preset scoped to the currently selected mode', () => {
    expect(resolveComposerProductModeFromAction('save-preset', 'research')).toBe('research');
    expect(createProductModeIntent('save-preset', 'board')).toMatchObject({
      actionId: 'save-preset',
      mode: 'board',
      source: 'composer-toolbar',
      type: 'product-mode-intent',
    });
  });

  test('creates typed product-mode intent payloads for action buttons', () => {
    expect(createProductModeIntent('rewrite-prompt', 'review')).toEqual({
      type: 'product-mode-intent',
      source: 'composer-toolbar',
      actionId: 'rewrite-prompt',
      mode: 'rewrite',
      labelKey: 'workbench.actions.rewritePrompt',
    });
  });

  test('exposes every product mode as a selector option with i18n keys', () => {
    const options = getComposerProductModeOptions();

    expect(options.map(option => option.id)).toEqual([
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
    ]);

    for (const option of options) {
      expect(option.labelKey).toBe(`workbench.modes.${option.id}.label`);
      expect(option.descriptionKey).toBe(`workbench.modes.${option.id}.description`);
    }
  });
});
