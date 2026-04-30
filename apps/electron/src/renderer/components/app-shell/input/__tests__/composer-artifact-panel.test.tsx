import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComposerArtifactPanel } from '../ComposerArtifactPanel';
import { createComposerArtifactState } from '../composer-artifact-flow';
import { createProductModeIntent } from '../product-mode-toolbar';

describe('ComposerArtifactPanel', () => {
  test('renders artifact screens inside the composer shell', () => {
    const promptLab = createComposerArtifactState({
      intent: createProductModeIntent('improve-prompt', 'research'),
      rawInput: 'Improve account UX',
    });
    const tddPlan = createComposerArtifactState({
      intent: createProductModeIntent('run-tdd-plan', 'research'),
      rawInput: 'Plan account UX tests',
    });
    const reviewGate = createComposerArtifactState({
      intent: createProductModeIntent('tear-down', 'research'),
      rawInput: 'This is the best account UX',
    });

    expect(renderToStaticMarkup(<ComposerArtifactPanel artifact={promptLab} />)).toContain('Prompt Lab');
    expect(renderToStaticMarkup(<ComposerArtifactPanel artifact={tddPlan} />)).toContain('TDD Plan');
    expect(renderToStaticMarkup(<ComposerArtifactPanel artifact={reviewGate} />)).toContain('Review Gate');
  });

  test('renders nothing when no artifact is active', () => {
    expect(renderToStaticMarkup(<ComposerArtifactPanel artifact={null} />)).toBe('');
  });
});
