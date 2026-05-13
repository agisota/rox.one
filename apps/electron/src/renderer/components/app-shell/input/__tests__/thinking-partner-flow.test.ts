import { describe, expect, test } from 'bun:test';
import type { ThinkingPartnerOutput } from '@rox-one/shared/workbench/thinking-partner';
import { createProductModeIntent, type ProductModeIntent } from '../product-mode-toolbar';
import {
  THINKING_PARTNER_SPEC_BUILDER_EVENT,
  createAddToSpecIntentFromSelections,
  createThinkingPartnerRequestFromComposer,
  createThinkingPartnerSpecBuilderIntent,
  shouldOpenThinkingPartnerForIntent,
} from '../thinking-partner-flow';

describe('thinking partner composer flow', () => {
  test('opens only for the Think With Me intent', () => {
    const legacyThinkingIntent: ProductModeIntent = {
      type: 'product-mode-intent',
      source: 'composer-toolbar',
      behavior: 'open-artifact',
      actionId: 'think-with-me' as ProductModeIntent['actionId'],
      mode: 'think',
      labelKey: 'workbench.actions.thinkWithMe',
    };

    expect(shouldOpenThinkingPartnerForIntent(legacyThinkingIntent)).toBe(true);
    expect(shouldOpenThinkingPartnerForIntent(createProductModeIntent('improve-prompt', 'rewrite'))).toBe(false);
  });

  test('creates a thinking partner request from composer input', () => {
    const request = createThinkingPartnerRequestFromComposer('  Build a review board  ', 'Ship a better workflow');

    expect(request.rawTask).toBe('Build a review board');
    expect(request.desiredOutcome).toBe('Ship a better workflow');
    expect(request.selectedRoles).toContain('product-strategist');
    expect(request.selectedRoles).toContain('qa-verifier');
  });

  test('rejects empty composer input before provider execution', () => {
    expect(() => createThinkingPartnerRequestFromComposer('   ', '')).toThrow('empty task');
  });

  test('creates Add-to-Spec intent with selected card ids', () => {
    const output = makeOutput();
    const intent = createAddToSpecIntentFromSelections(output, {
      hypothesisIds: ['h1'],
      questionIds: ['q1'],
      optionIds: ['o1'],
    });

    expect(intent.source).toBe('thinking-partner');
    expect(intent.selectedHypotheses.map((card) => card.id)).toEqual(['h1']);
    expect(intent.selectedQuestions.map((card) => card.id)).toEqual(['q1']);
    expect(intent.selectedOptions.map((card) => card.id)).toEqual(['o1']);
  });

  test('Generate Spec creates a typed spec-builder payload', () => {
    const output = makeOutput();
    const intent = createThinkingPartnerSpecBuilderIntent(output);

    expect(THINKING_PARTNER_SPEC_BUILDER_EVENT).toBe('craft:spec-builder-intent');
    expect(intent.targetMode).toBe('spec');
    expect(intent.labels).toContain('mode::think');
  });
});

function makeOutput(): ThinkingPartnerOutput {
  return {
    problemFrame: 'Frame the problem',
    assumptions: ['Assumption'],
    unknowns: ['Unknown'],
    hypotheses: [{ id: 'h1', claim: 'Claim', evidence: 'Evidence', risk: 'Risk', nextAction: 'Next action' }],
    clarifyingQuestions: [{ id: 'q1', question: 'Question?', rationale: 'Rationale', priority: 'high' }],
    roleCards: [{ roleId: 'product-strategist', title: 'Product Strategist', summary: 'Summary', recommendation: 'Recommendation' }],
    optionCards: [{ id: 'o1', label: 'Option', description: 'Description', tradeoff: 'Tradeoff', recommended: true }],
    recommendedDeliverables: ['Spec Builder input'],
  };
}
