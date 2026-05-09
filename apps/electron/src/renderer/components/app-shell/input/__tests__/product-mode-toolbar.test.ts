import { describe, expect, test } from 'bun:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
import { ProductModeToolbar } from '../ProductModeToolbar';

const REQUIRED_ACTIONS: Array<[ComposerProductModeActionId, ProductMode]> = [
  ['improve-prompt', 'rewrite'],
  ['run-tdd-plan', 'tdd'],
  ['verify', 'verify'],
  ['tear-down', 'review'],
  ['build-spec', 'spec'],
  ['review', 'review'],
];

describe('product mode toolbar contract', () => {
  test('declares the default product mode for the composer', () => {
    expect(PRODUCT_MODE_TOOLBAR_DEFAULT_MODE).toBe('research');
  });

  test('renders the required composer action order', () => {
    expect([...COMPOSER_PRODUCT_MODE_ACTION_IDS]).toEqual(REQUIRED_ACTIONS.map(([actionId]) => actionId));
    expect(getComposerProductModeActions().map(action => action.id)).toEqual([...COMPOSER_PRODUCT_MODE_ACTION_IDS]);
    expect(getComposerProductModeActions().map(action => action.descriptionKey)).toEqual([
      'workbench.actions.improvePrompt.description',
      'workbench.actions.runTddPlan.description',
      'workbench.actions.verify.description',
      'workbench.actions.tearDown.description',
      'workbench.actions.buildSpec.description',
      'workbench.actions.review.description',
    ]);
  });

  test('maps every action to the expected product mode', () => {
    for (const [actionId, expectedMode] of REQUIRED_ACTIONS) {
      expect(resolveComposerProductModeFromAction(actionId, 'review')).toBe(expectedMode);
    }
  });

  test('keeps tear-down scoped to review gate without changing submit mode', () => {
    expect(resolveComposerProductModeFromAction('tear-down', 'research')).toBe('review');
    expect(createProductModeIntent('tear-down', 'board')).toMatchObject({
      actionId: 'tear-down',
      mode: 'review',
      source: 'composer-toolbar',
      type: 'product-mode-intent',
    });
  });

  test('creates typed product-mode intent payloads for action buttons', () => {
    expect(createProductModeIntent('improve-prompt', 'review')).toEqual({
      type: 'product-mode-intent',
      source: 'composer-toolbar',
      actionId: 'improve-prompt',
      mode: 'rewrite',
      labelKey: 'workbench.actions.improvePrompt',
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

  test('renders a custom mode picker and does not depend on a native select', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ProductModeToolbar, {
        selectedMode: 'research',
        onModeChange: () => undefined,
        onIntent: () => undefined,
      }),
    );

    expect(markup).toContain('data-testid="product-mode-toolbar"');
    expect(markup).toContain('data-testid="product-mode-picker"');
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-controls=');
    expect(markup).toContain('data-state="closed"');
    expect(markup).toContain('<svg');
    expect(markup).toContain('title="workbench.actions.improvePrompt.description"');
    expect(markup).not.toContain('>v</span>');
    expect(markup).not.toContain('data-testid="product-mode-select"');
    expect(markup).not.toContain('<select');
  });
});
