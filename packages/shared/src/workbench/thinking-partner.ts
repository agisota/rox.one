import { z } from 'zod';

export const ThinkingPartnerRoleIdSchema = z.enum([
  'product-strategist',
  'system-architect',
  'skeptic',
  'operator',
  'researcher',
  'customer-advocate',
  'qa-verifier',
]);

export type ThinkingPartnerRoleId = z.infer<typeof ThinkingPartnerRoleIdSchema>;

export interface ThinkingPartnerRoleDefinition {
  id: ThinkingPartnerRoleId;
  name: string;
  prompt: string;
  outputContract: string[];
}

export const THINKING_PARTNER_ROLES: ThinkingPartnerRoleDefinition[] = [
  role('product-strategist', 'Product Strategist', ['market framing', 'user value', 'product tradeoffs']),
  role('system-architect', 'System Architect', ['system boundaries', 'data flow', 'integration risk']),
  role('skeptic', 'Skeptic', ['hidden assumptions', 'failure modes', 'weak evidence']),
  role('operator', 'Operator', ['execution sequence', 'ownership', 'operational constraints']),
  role('researcher', 'Researcher', ['source needs', 'unknown facts', 'verification plan']),
  role('customer-advocate', 'Customer Advocate', ['user pain', 'usability constraints', 'success criteria']),
  role('qa-verifier', 'QA/Verifier', ['acceptance criteria', 'test matrix', 'risk-based validation']),
];

export const DEFAULT_THINKING_PARTNER_ROLE_IDS: ThinkingPartnerRoleId[] = [
  'product-strategist',
  'system-architect',
  'skeptic',
  'qa-verifier',
];

export const ThinkingPartnerInputSchema = z.object({
  rawTask: z.string().trim().min(1, 'rawTask is required'),
  userContext: z.string().trim().default(''),
  desiredOutcome: z.string().trim().default(''),
  selectedRoles: z.array(ThinkingPartnerRoleIdSchema).min(1).default(DEFAULT_THINKING_PARTNER_ROLE_IDS),
});

export const ThinkingPartnerHypothesisCardSchema = z.object({
  id: z.string().trim().min(1),
  claim: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
  risk: z.string().trim().min(1),
  nextAction: z.string().trim().min(1),
});

export const ThinkingPartnerQuestionCardSchema = z.object({
  id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  rationale: z.string().trim().min(1),
  priority: z.enum(['low', 'medium', 'high']),
});

export const ThinkingPartnerRoleCardSchema = z.object({
  roleId: ThinkingPartnerRoleIdSchema,
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
});

export const ThinkingPartnerOptionCardSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  tradeoff: z.string().trim().min(1),
  recommended: z.boolean().default(false),
});

export const ThinkingPartnerOutputSchema = z.object({
  problemFrame: z.string().trim().min(1),
  assumptions: z.array(z.string().trim().min(1)).default([]),
  unknowns: z.array(z.string().trim().min(1)).default([]),
  hypotheses: z.array(ThinkingPartnerHypothesisCardSchema).default([]),
  clarifyingQuestions: z.array(ThinkingPartnerQuestionCardSchema).default([]),
  roleCards: z.array(ThinkingPartnerRoleCardSchema).default([]),
  optionCards: z.array(ThinkingPartnerOptionCardSchema).default([]),
  recommendedDeliverables: z.array(z.string().trim().min(1)).default([]),
});

export type ThinkingPartnerInput = z.infer<typeof ThinkingPartnerInputSchema>;
export type ThinkingPartnerHypothesisCard = z.infer<typeof ThinkingPartnerHypothesisCardSchema>;
export type ThinkingPartnerQuestionCard = z.infer<typeof ThinkingPartnerQuestionCardSchema>;
export type ThinkingPartnerRoleCard = z.infer<typeof ThinkingPartnerRoleCardSchema>;
export type ThinkingPartnerOptionCard = z.infer<typeof ThinkingPartnerOptionCardSchema>;
export type ThinkingPartnerOutput = z.infer<typeof ThinkingPartnerOutputSchema>;

export interface ThinkingPartnerProvider {
  think(input: ThinkingPartnerInput): Promise<ThinkingPartnerOutput> | ThinkingPartnerOutput;
}

export interface ThinkingPartnerService {
  think(input: ThinkingPartnerInput): Promise<ThinkingPartnerOutput>;
}

export function createThinkingPartnerService(options: { provider: ThinkingPartnerProvider }): ThinkingPartnerService {
  return {
    async think(input) {
      const parsedInput = ThinkingPartnerInputSchema.parse(input);
      const providerOutput = await options.provider.think(parsedInput);
      return ThinkingPartnerOutputSchema.parse(providerOutput);
    },
  };
}

export function createDeterministicThinkingPartnerProvider(): ThinkingPartnerProvider {
  return {
    think(input) {
      const parsedInput = ThinkingPartnerInputSchema.parse(input);
      const roles = parsedInput.selectedRoles.length > 0 ? parsedInput.selectedRoles : DEFAULT_THINKING_PARTNER_ROLE_IDS;
      const roleDefinitions = roles.map((roleId) => getThinkingPartnerRole(roleId));

      return {
        problemFrame: `Frame the task before execution: ${parsedInput.rawTask}`,
        assumptions: [
          'The user wants structured reasoning before implementation.',
          parsedInput.userContext || 'No additional user context was provided.',
        ],
        unknowns: [
          parsedInput.desiredOutcome || 'The exact success metric should be confirmed.',
          'The minimal acceptable deliverable depth should be chosen before execution.',
        ],
        hypotheses: [
          {
            id: 'h-primary-user-outcome',
            claim: `The task should be reframed around the user outcome: ${parsedInput.rawTask}.`,
            evidence: 'The request is broad enough that immediate implementation would hide product and validation choices.',
            risk: 'Skipping framing can produce a technically correct but strategically wrong artifact.',
            nextAction: 'Convert the selected hypotheses into Spec Builder requirements.',
          },
          {
            id: 'h-validation-first',
            claim: 'Validation requirements should be selected before implementation starts.',
            evidence: 'The Agent Workbench backlog uses TDD gates and explicit acceptance criteria.',
            risk: 'Unvalidated execution creates ambiguous completion and weak review handoff.',
            nextAction: 'Attach validation gates to the generated spec.',
          },
        ],
        clarifyingQuestions: [
          {
            id: 'q-success-metric',
            question: 'What observable result proves this work is successful?',
            rationale: 'A success metric prevents the agent from optimizing for output volume instead of usefulness.',
            priority: 'high',
          },
          {
            id: 'q-constraints',
            question: 'Which constraints are non-negotiable for this task?',
            rationale: 'Hard constraints should shape the spec before execution begins.',
            priority: 'medium',
          },
        ],
        roleCards: roleDefinitions.map((definition) => ({
          roleId: definition.id,
          title: definition.name,
          summary: `${definition.name} reviews ${definition.outputContract.join(', ')}.`,
          recommendation: `Use ${definition.name} input to sharpen the Spec Builder options before execution.`,
        })),
        optionCards: [
          {
            id: 'o-generate-spec',
            label: 'Generate Spec Builder input',
            description: 'Turn selected hypotheses, questions, and role recommendations into a structured spec payload.',
            tradeoff: 'Adds one planning step, but reduces implementation ambiguity.',
            recommended: true,
          },
          {
            id: 'o-ask-follow-up',
            label: 'Ask follow-up questions first',
            description: 'Pause execution and answer the highest-priority unknowns before generating a spec.',
            tradeoff: 'Slower start, stronger requirement fit.',
            recommended: false,
          },
        ],
        recommendedDeliverables: ['Spec Builder input', 'Selected hypotheses', 'Clarifying questions', 'Validation notes'],
      };
    },
  };
}

export function getThinkingPartnerRole(roleId: ThinkingPartnerRoleId): ThinkingPartnerRoleDefinition {
  const roleDefinition = THINKING_PARTNER_ROLES.find((role) => role.id === roleId);
  if (!roleDefinition) {
    throw new Error(`Unknown thinking partner role: ${roleId}`);
  }
  return roleDefinition;
}

function role(
  id: ThinkingPartnerRoleId,
  name: string,
  outputContract: string[],
): ThinkingPartnerRoleDefinition {
  return {
    id,
    name,
    prompt: `${name} must inspect the task, state concrete risks, and return only structured reasoning cards.`,
    outputContract,
  };
}
