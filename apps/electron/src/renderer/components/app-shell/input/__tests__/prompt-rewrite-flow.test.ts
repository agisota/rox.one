import { describe, expect, test } from 'bun:test';
import type { PromptRewriteOutput } from '@craft-agent/shared/workbench';
import { PRODUCT_MODE_TOOLBAR_DEFAULT_MODE, createProductModeIntent } from '../product-mode-toolbar';
import {
  PROMPT_REWRITE_SPEC_BUILDER_EVENT,
  applyPromptRewriteAcceptance,
  createPromptRewriteRequestFromComposer,
  createSpecBuilderIntentFromRewrite,
  shouldOpenPromptRewriteForIntent,
} from '../prompt-rewrite-flow';

describe('prompt rewrite composer flow', () => {
  test('opens only for the rewrite prompt intent', () => {
    expect(shouldOpenPromptRewriteForIntent(createProductModeIntent('improve-prompt', 'build'))).toBe(true);
    expect(shouldOpenPromptRewriteForIntent(createProductModeIntent('run-tdd-plan', 'tdd'))).toBe(false);
  });

  test('creates a build-ready request from composer input', () => {
    const request = createPromptRewriteRequestFromComposer('  Build an account cabinet  ', PRODUCT_MODE_TOOLBAR_DEFAULT_MODE);

    expect(request.originalPrompt).toBe('Build an account cabinet');
    expect(request.rewriteStyle).toBe('build_ready');
    expect(request.targetMode).toBe('research');
  });

  test('rejects empty composer input before provider execution', () => {
    expect(() => createPromptRewriteRequestFromComposer('   ', 'rewrite')).toThrow('empty prompt');
  });

  test('accepting rewrite returns rewritten prompt text', () => {
    const output = makeOutput({ rewrittenPrompt: 'Use this stronger prompt.' });
    expect(applyPromptRewriteAcceptance(output, 'Manual edit')).toBe('Manual edit');
    expect(applyPromptRewriteAcceptance(output)).toBe('Use this stronger prompt.');
  });

  test('send to spec builder creates a typed event payload', () => {
    const output = makeOutput({ rewrittenPrompt: 'Build-ready prompt' });
    const intent = createSpecBuilderIntentFromRewrite(output);

    expect(PROMPT_REWRITE_SPEC_BUILDER_EVENT).toBe('craft:spec-builder-intent');
    expect(intent.source).toBe('prompt-rewrite');
    expect(intent.rewriteOutput.rewrittenPrompt).toBe('Build-ready prompt');
  });
});

function makeOutput(overrides: Partial<PromptRewriteOutput> = {}): PromptRewriteOutput {
  return {
    originalPrompt: 'Raw prompt',
    rewrittenPrompt: 'Rewritten prompt',
    role: 'Staff engineer',
    objective: 'Clarify implementation',
    context: 'Composer input',
    assumptions: [],
    constraints: [],
    deliverables: [],
    acceptanceCriteria: [],
    verificationPlan: [],
    missingQuestions: [],
    ...overrides,
  };
}
