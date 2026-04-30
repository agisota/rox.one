import { describe, expect, test } from 'bun:test';
import { createProductModeIntent } from '../product-mode-toolbar';
import { createComposerArtifactState, shouldOpenComposerArtifactForIntent } from '../composer-artifact-flow';

describe('composer artifact flow', () => {
  test('routes improve-prompt to Prompt Lab without submitting', () => {
    const state = createComposerArtifactState({
      intent: createProductModeIntent('improve-prompt', 'research'),
      rawInput: 'Build native account login',
    });

    expect(shouldOpenComposerArtifactForIntent(state.intent)).toBe(true);
    expect(state.kind).toBe('prompt-lab');
    expect(state.shouldSubmit).toBe(false);
    expect(state.promptLab?.status).toBe('success');
    expect(state.promptLab?.output?.rewrittenPrompt).toContain('Build native account login');
  });

  test('routes empty improve-prompt to Prompt Lab error state without provider execution', () => {
    const state = createComposerArtifactState({
      intent: createProductModeIntent('improve-prompt', 'research'),
      rawInput: '   ',
    });

    expect(state.kind).toBe('prompt-lab');
    expect(state.shouldSubmit).toBe(false);
    expect(state.promptLab?.status).toBe('error');
    expect(state.promptLab?.error).toContain('empty prompt');
  });

  test('routes TDD Plan to generated red-green-verify-worklog state', () => {
    const state = createComposerArtifactState({
      intent: createProductModeIntent('run-tdd-plan', 'research'),
      rawInput: 'Add billing webhook idempotency',
    });

    expect(state.kind).toBe('tdd-plan');
    expect(state.shouldSubmit).toBe(false);
    expect(state.tddPlan?.pack.tasks.map(task => task.phase)).toEqual(['red', 'green', 'verify', 'worklog']);
  });

  test('routes verify and tear-down to Review Gate variants', () => {
    const verify = createComposerArtifactState({
      intent: createProductModeIntent('verify', 'research'),
      rawInput: 'Verify team spaces',
    });
    const tearDown = createComposerArtifactState({
      intent: createProductModeIntent('tear-down', 'research'),
      rawInput: 'This is the best team spaces design',
    });

    expect(verify.kind).toBe('review-gate');
    expect(verify.reviewGate?.activeTab).toBe('check');
    expect(tearDown.kind).toBe('review-gate');
    expect(tearDown.reviewGate?.activeTab).toBe('tear-down');
  });

  test('routes build-spec to Spec Builder state', () => {
    const state = createComposerArtifactState({
      intent: createProductModeIntent('build-spec', 'research'),
      rawInput: 'Create a team invite spec',
    });

    expect(state.kind).toBe('spec-builder');
    expect(state.shouldSubmit).toBe(false);
    expect(state.specBuilder?.rawInput).toBe('Create a team invite spec');
    expect(state.specBuilder?.modeId).toBe('spec');
  });
});
