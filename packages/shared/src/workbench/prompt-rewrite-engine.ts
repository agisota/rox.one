import { z } from 'zod';
import { ProductModeSchema } from './product-mode-registry';

export const PromptRewriteStyleSchema = z.enum([
  'short',
  'detailed',
  'expert',
  'build_ready',
  'research_grade',
]);

export const PromptRewriteRequestSchema = z.object({
  originalPrompt: z.string().trim().min(1, 'originalPrompt is required'),
  rewriteStyle: PromptRewriteStyleSchema,
  targetMode: ProductModeSchema,
  constraints: z.array(z.string().trim().min(1)).default([]),
});

export const PromptRewriteOutputSchema = z.object({
  originalPrompt: z.string().trim().min(1),
  rewrittenPrompt: z.string().trim().min(1),
  role: z.string().trim().min(1),
  objective: z.string().trim().min(1),
  context: z.string().trim().min(1),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  constraints: z.array(z.string().trim().min(1)).default([]),
  deliverables: z.array(z.string().trim().min(1)).default([]),
  acceptanceCriteria: z.array(z.string().trim().min(1)).default([]),
  verificationPlan: z.array(z.string().trim().min(1)).default([]),
  missingQuestions: z.array(z.string().trim().min(1)).default([]),
});

export type PromptRewriteStyle = z.infer<typeof PromptRewriteStyleSchema>;
export type PromptRewriteRequest = z.infer<typeof PromptRewriteRequestSchema>;
export type PromptRewriteOutput = z.infer<typeof PromptRewriteOutputSchema>;

export interface PromptRewriteProvider {
  rewrite(request: PromptRewriteRequest): Promise<PromptRewriteOutput> | PromptRewriteOutput;
}

export interface PromptRewriteService {
  rewrite(request: PromptRewriteRequest): Promise<PromptRewriteOutput>;
}

export function createPromptRewriteService(options: { provider: PromptRewriteProvider }): PromptRewriteService {
  return {
    async rewrite(request) {
      const parsedRequest = PromptRewriteRequestSchema.parse(request);
      const providerOutput = await options.provider.rewrite(parsedRequest);
      return PromptRewriteOutputSchema.parse(providerOutput);
    },
  };
}

export function createDeterministicPromptRewriteProvider(): PromptRewriteProvider {
  return {
    rewrite(request) {
      const parsedRequest = PromptRewriteRequestSchema.parse(request);
      const styleGuidance = getStyleGuidance(parsedRequest.rewriteStyle);
      const acceptanceCriteria = [
        'The rewritten prompt states the concrete objective and expected deliverables.',
        'The rewritten prompt includes verifiable acceptance criteria.',
      ];
      const verificationPlan = [
        'Review the prompt for role, context, constraints, deliverables, and testable outcomes.',
        'Confirm no real provider call is required to generate this deterministic rewrite.',
      ];

      if (parsedRequest.rewriteStyle === 'research_grade') {
        acceptanceCriteria.push('The prompt asks for cited sources and separates facts from assumptions.');
        verificationPlan.push('Check that source requirements and recency constraints are explicit.');
      }

      if (parsedRequest.rewriteStyle === 'build_ready') {
        acceptanceCriteria.push('The prompt can be handed to an implementation agent without extra interpretation.');
        verificationPlan.push('Map each acceptance criterion to a concrete validation command or manual check.');
      }

      return {
        originalPrompt: parsedRequest.originalPrompt,
        rewrittenPrompt: [
          'Role: Staff full-stack engineer and release-quality verifier.',
          `Objective: ${parsedRequest.originalPrompt}`,
          `Mode: ${parsedRequest.targetMode}.`,
          `Rewrite style: ${styleGuidance}`,
          parsedRequest.constraints.length > 0
            ? `Constraints: ${parsedRequest.constraints.join('; ')}.`
            : 'Constraints: preserve existing behavior, avoid speculative implementation, and keep verification explicit.',
          `Deliverables: ${acceptanceCriteria.join(' ')}`,
          `Verification: ${verificationPlan.join(' ')}`,
        ].join('\n'),
        role: 'Staff full-stack engineer and release-quality verifier',
        objective: parsedRequest.originalPrompt,
        context: `Composer prompt rewritten for ${parsedRequest.targetMode} mode.`,
        assumptions: ['The user wants a clearer, executable prompt rather than immediate task execution.'],
        constraints: parsedRequest.constraints,
        deliverables: [
          'Rewritten prompt',
          'Acceptance criteria',
          'Verification plan',
        ],
        acceptanceCriteria,
        verificationPlan,
        missingQuestions: [],
      };
    },
  };
}

export interface PromptRewriteHistoryContext {
  userId: string;
  workspaceId: string;
  teamId?: string;
  sessionId?: string;
  taskId?: string;
  createdAt?: string;
}

export interface PromptRewriteHistoryEvent extends PromptRewriteHistoryContext {
  eventType: 'prompt_rewrite';
  mode: 'rewrite';
  labels: ['mode::rewrite', 'artifact::prompt'];
  artifactType: 'prompt';
  summary: string;
  originalPrompt: string;
  rewrittenPrompt: string;
}

export function createPromptRewriteHistoryEvent(
  output: PromptRewriteOutput,
  context: PromptRewriteHistoryContext,
): PromptRewriteHistoryEvent {
  const parsedOutput = PromptRewriteOutputSchema.parse(output);

  return {
    ...context,
    createdAt: context.createdAt ?? new Date(0).toISOString(),
    eventType: 'prompt_rewrite',
    mode: 'rewrite',
    labels: ['mode::rewrite', 'artifact::prompt'],
    artifactType: 'prompt',
    summary: `Prompt rewritten: ${truncateSummary(parsedOutput.originalPrompt)}`,
    originalPrompt: parsedOutput.originalPrompt,
    rewrittenPrompt: parsedOutput.rewrittenPrompt,
  };
}

function getStyleGuidance(style: PromptRewriteStyle): string {
  switch (style) {
    case 'short':
      return 'compact and direct';
    case 'detailed':
      return 'expanded with context and deliverables';
    case 'expert':
      return 'expert-level with assumptions and constraints';
    case 'build_ready':
      return 'implementation-ready with acceptance criteria and verification';
    case 'research_grade':
      return 'research-grade with source and fact-check requirements';
  }
}

function truncateSummary(value: string): string {
  return value.length <= 80 ? value : `${value.slice(0, 77)}...`;
}
