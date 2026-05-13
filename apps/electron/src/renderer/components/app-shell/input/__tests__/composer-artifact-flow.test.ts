import { describe, expect, test } from 'bun:test';
import { createOpenArtifactProductModeIntent, createProductModeIntent } from '../product-mode-toolbar';
import {
  createComposerArtifactState,
  createExperienceEventsForComposerArtifact,
  shouldOpenComposerArtifactForIntent,
} from '../composer-artifact-flow';
import {
  createInitialExperienceRuntimeState,
  replayExperienceEvents,
} from '@rox-one/shared/workbench';

describe('composer artifact flow', () => {
  test('does not route default quick actions to artifact screens', () => {
    const intent = createProductModeIntent('improve-prompt', 'research');

    expect(shouldOpenComposerArtifactForIntent(intent)).toBe(false);
    expect(() => createComposerArtifactState({
      intent,
      rawInput: 'Build native account login',
    })).toThrow('explicit open-artifact intent');
  });

  test('routes explicit Prompt Lab artifact intent without submitting', () => {
    const state = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('prompt-lab', 'research'),
      rawInput: 'Build native account login',
    });

    expect(shouldOpenComposerArtifactForIntent(state.intent)).toBe(true);
    expect(state.kind).toBe('prompt-lab');
    expect(state.shouldSubmit).toBe(false);
    expect(state.promptLab?.status).toBe('success');
    expect(state.promptLab?.output?.rewrittenPrompt).toContain('Build native account login');
  });

  test('rejects explicit artifact screens without valid input', () => {
    expect(() => createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('prompt-lab', 'research'),
      rawInput: '   ',
    })).toThrow('valid artifact input');
  });

  test('routes TDD Plan to generated red-green-verify-worklog state', () => {
    const state = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('tdd-plan', 'research'),
      rawInput: 'Add billing webhook idempotency',
    });

    expect(state.kind).toBe('tdd-plan');
    expect(state.shouldSubmit).toBe(false);
    expect(state.tddPlan?.pack.tasks.map(task => task.phase)).toEqual(['red', 'green', 'verify', 'worklog']);
  });

  test('routes verify and tear-down to Review Gate variants', () => {
    const verify = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('review-gate', 'research', { actionId: 'verify' }),
      rawInput: 'Verify team spaces',
    });
    const tearDown = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('review-gate', 'research', { actionId: 'tear-down' }),
      rawInput: 'This is the best team spaces design',
    });

    expect(verify.kind).toBe('review-gate');
    expect(verify.reviewGate?.activeTab).toBe('check');
    expect(tearDown.kind).toBe('review-gate');
    expect(tearDown.reviewGate?.activeTab).toBe('tear-down');
  });

  test('routes build-spec to Spec Builder state', () => {
    const state = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('spec-builder', 'research'),
      rawInput: 'Create a team invite spec',
    });

    expect(state.kind).toBe('spec-builder');
    expect(state.shouldSubmit).toBe(false);
    expect(state.specBuilder?.rawInput).toBe('Create a team invite spec');
    expect(state.specBuilder?.modeId).toBe('spec');
  });

  test('emits Experience events for prompt rewrite and advances rewrite quest', () => {
    const state = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('prompt-lab', 'research'),
      rawInput: 'Build native account login',
    });
    const events = createExperienceEventsForComposerArtifact(state, {
      createdAt: '2026-05-06T00:00:00.000Z',
      actorId: 'user-one',
    });

    expect(events.map((event) => event.type)).toEqual(['prompt.submitted', 'prompt.rewritten']);

    const runtimeState = replayExperienceEvents(events, createInitialExperienceRuntimeState());
    expect(runtimeState.questProgress.find((progress) => progress.questId === 'quest-rewrite-prompt')?.status).toBe('completed');
  });

  test('emits Experience events for spec compile and TDD plan artifacts', () => {
    const specState = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('spec-builder', 'research'),
      rawInput: 'Create a team invite spec',
    });
    const tddState = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('tdd-plan', 'research'),
      rawInput: 'Add billing webhook idempotency',
    });

    expect(createExperienceEventsForComposerArtifact(specState, { createdAt: '2026-05-06T00:00:00.000Z' }).map((event) => event.type)).toEqual(['spec.compiled']);
    expect(createExperienceEventsForComposerArtifact(tddState, { createdAt: '2026-05-06T00:00:00.000Z' }).map((event) => event.type)).toEqual(['tdd.plan.created']);
  });

  test('emits review failure events that become HUD blockers', () => {
    const state = createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent('review-gate', 'review', { actionId: 'tear-down' }),
      rawInput: 'This is the guaranteed best architecture with api_key: leaked',
    });
    const events = createExperienceEventsForComposerArtifact(state, {
      createdAt: '2026-05-06T00:00:00.000Z',
    });

    expect(events.map((event) => event.type)).toContain('review.completed');
    expect(events.map((event) => event.type)).toContain('gate.failed');
    expect(events.some((event) => event.type === 'gate.failed' && event.payload.blocking === true)).toBe(true);
  });
});
