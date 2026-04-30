import { describe, expect, test } from 'bun:test';
import {
  THINKING_PARTNER_ROLES,
  ThinkingPartnerOutputSchema,
  createDeterministicThinkingPartnerProvider,
  createThinkingPartnerService,
} from '../thinking-partner';

describe('thinking partner engine', () => {
  test('declares the required round-table roles with prompts and output contracts', () => {
    expect(THINKING_PARTNER_ROLES.map((role) => role.id)).toEqual([
      'product-strategist',
      'system-architect',
      'skeptic',
      'operator',
      'researcher',
      'customer-advocate',
      'qa-verifier',
    ]);

    for (const role of THINKING_PARTNER_ROLES) {
      expect(role.name).toBeTruthy();
      expect(role.prompt).toContain(role.name);
      expect(role.outputContract.length).toBeGreaterThan(0);
    }
  });

  test('requires hypothesis cards to include claim, evidence, risk, and nextAction', () => {
    expect(() => ThinkingPartnerOutputSchema.parse({
      problemFrame: 'Frame',
      assumptions: [],
      unknowns: [],
      hypotheses: [{ id: 'h1', claim: 'Claim', evidence: 'Evidence', risk: 'Risk' }],
      clarifyingQuestions: [],
      roleCards: [],
      optionCards: [],
      recommendedDeliverables: [],
    })).toThrow();
  });

  test('deterministic provider returns role, hypothesis, question, and option cards', async () => {
    const service = createThinkingPartnerService({ provider: createDeterministicThinkingPartnerProvider() });

    const output = await service.think({
      rawTask: 'Design a team workspace flow',
      userContext: 'Agent Workbench desktop/cloud fork',
      desiredOutcome: 'Clear product options before implementation',
      selectedRoles: ['product-strategist', 'skeptic', 'qa-verifier'],
    });

    expect(output.problemFrame).toContain('Design a team workspace flow');
    expect(output.roleCards.map((card) => card.roleId)).toEqual(['product-strategist', 'skeptic', 'qa-verifier']);
    expect(output.hypotheses.length).toBeGreaterThan(0);
    expect(output.clarifyingQuestions.length).toBeGreaterThan(0);
    expect(output.optionCards.length).toBeGreaterThan(0);
    expect(output.recommendedDeliverables).toContain('Spec Builder input');
  });

  test('service validates malformed provider output', async () => {
    const service = createThinkingPartnerService({
      provider: {
        think: async () => ({ problemFrame: '' }) as never,
      },
    });

    await expect(service.think({
      rawTask: 'Frame this task',
      userContext: '',
      desiredOutcome: '',
      selectedRoles: ['operator'],
    })).rejects.toThrow();
  });
});
