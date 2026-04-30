import { describe, expect, test } from 'bun:test';
import {
  PromptRewriteOutputSchema,
  PromptRewriteRequestSchema,
  createDeterministicPromptRewriteProvider,
  createPromptRewriteHistoryEvent,
  createPromptRewriteService,
} from '../prompt-rewrite-engine';

describe('prompt rewrite engine', () => {
  test('rejects an empty original prompt', () => {
    expect(() => PromptRewriteRequestSchema.parse({
      originalPrompt: '   ',
      rewriteStyle: 'build_ready',
      targetMode: 'rewrite',
      constraints: [],
    })).toThrow();
  });

  test('requires rewrittenPrompt in provider output', () => {
    expect(() => PromptRewriteOutputSchema.parse({
      originalPrompt: 'Build a dashboard',
      role: 'Product architect',
      objective: 'Clarify the task',
      context: 'User request',
      assumptions: [],
      constraints: [],
      deliverables: [],
      acceptanceCriteria: [],
      verificationPlan: [],
      missingQuestions: [],
    })).toThrow();
  });

  test('deterministic build-ready rewrite includes acceptance criteria and verification plan', async () => {
    const service = createPromptRewriteService({ provider: createDeterministicPromptRewriteProvider() });

    const output = await service.rewrite({
      originalPrompt: 'Make the account cabinet work inside the desktop app',
      rewriteStyle: 'build_ready',
      targetMode: 'build',
      constraints: ['No real LLM calls in tests'],
    });

    expect(output.originalPrompt).toBe('Make the account cabinet work inside the desktop app');
    expect(output.rewrittenPrompt).toContain('Make the account cabinet work inside the desktop app');
    expect(output.acceptanceCriteria.length).toBeGreaterThan(0);
    expect(output.verificationPlan.length).toBeGreaterThan(0);
  });

  test('service validates malformed provider output', async () => {
    const service = createPromptRewriteService({
      provider: {
        rewrite: async () => ({ rewrittenPrompt: '' }) as never,
      },
    });

    await expect(service.rewrite({
      originalPrompt: 'Improve this prompt',
      rewriteStyle: 'expert',
      targetMode: 'rewrite',
      constraints: [],
    })).rejects.toThrow();
  });

  test('creates a rewrite history event with mode and artifact labels', async () => {
    const service = createPromptRewriteService({ provider: createDeterministicPromptRewriteProvider() });
    const output = await service.rewrite({
      originalPrompt: 'Draft a spec',
      rewriteStyle: 'build_ready',
      targetMode: 'spec',
      constraints: [],
    });

    const event = createPromptRewriteHistoryEvent(output, { userId: 'local-user', workspaceId: 'local-workspace' });

    expect(event.labels).toContain('mode::rewrite');
    expect(event.labels).toContain('artifact::prompt');
    expect(event.summary).toContain('Draft a spec');
  });
});
