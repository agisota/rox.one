import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

mock.module('sonner', () => ({
  toast: {
    error: () => undefined,
    success: () => undefined,
  },
}));

async function loadComposerArtifactModules() {
  const [panel, flow, toolbar] = await Promise.all([
    import('../ComposerArtifactPanel'),
    import('../composer-artifact-flow'),
    import('../product-mode-toolbar'),
  ]);

  return {
    ComposerArtifactPanel: panel.ComposerArtifactPanel,
    createComposerArtifactState: flow.createComposerArtifactState,
    createProductModeIntent: toolbar.createProductModeIntent,
  };
}

describe('ComposerArtifactPanel', () => {
  test('renders artifact screens inside the composer shell', async () => {
    const {
      ComposerArtifactPanel,
      createComposerArtifactState,
      createProductModeIntent,
    } = await loadComposerArtifactModules();
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

  test('renders nothing when no artifact is active', async () => {
    const { ComposerArtifactPanel } = await loadComposerArtifactModules();
    expect(renderToStaticMarkup(<ComposerArtifactPanel artifact={null} />)).toBe('');
  });
});
