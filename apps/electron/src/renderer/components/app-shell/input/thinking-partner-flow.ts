import {
  DEFAULT_THINKING_PARTNER_ROLE_IDS,
  type ThinkingPartnerHypothesisCard,
  type ThinkingPartnerInput,
  type ThinkingPartnerOptionCard,
  type ThinkingPartnerOutput,
  type ThinkingPartnerQuestionCard,
} from '@craft-agent/shared/workbench/thinking-partner';
import type { ProductModeIntent } from './product-mode-toolbar';

export const THINKING_PARTNER_SPEC_BUILDER_EVENT = 'craft:spec-builder-intent';

export interface ThinkingPartnerSelections {
  hypothesisIds?: string[];
  questionIds?: string[];
  optionIds?: string[];
}

export interface ThinkingPartnerSpecBuilderIntent {
  type: 'spec-builder-intent';
  source: 'thinking-partner';
  targetMode: 'spec';
  labels: ['mode::think', 'artifact::spec'];
  thinkingOutput: ThinkingPartnerOutput;
  selectedHypotheses: ThinkingPartnerHypothesisCard[];
  selectedQuestions: ThinkingPartnerQuestionCard[];
  selectedOptions: ThinkingPartnerOptionCard[];
}

export function shouldOpenThinkingPartnerForIntent(intent: ProductModeIntent): boolean {
  return intent.actionId === 'think-with-me';
}

export function createThinkingPartnerRequestFromComposer(
  composerInput: string,
  desiredOutcome = '',
): ThinkingPartnerInput {
  const rawTask = composerInput.trim();

  if (!rawTask) {
    throw new Error('empty task');
  }

  return {
    rawTask,
    userContext: '',
    desiredOutcome: desiredOutcome.trim(),
    selectedRoles: DEFAULT_THINKING_PARTNER_ROLE_IDS,
  };
}

export function createAddToSpecIntentFromSelections(
  output: ThinkingPartnerOutput,
  selections: ThinkingPartnerSelections = {},
): ThinkingPartnerSpecBuilderIntent {
  const selectedHypotheses = selectById(output.hypotheses, selections.hypothesisIds);
  const selectedQuestions = selectById(output.clarifyingQuestions, selections.questionIds);
  const selectedOptions = selectById(output.optionCards, selections.optionIds);

  return {
    type: 'spec-builder-intent',
    source: 'thinking-partner',
    targetMode: 'spec',
    labels: ['mode::think', 'artifact::spec'],
    thinkingOutput: output,
    selectedHypotheses,
    selectedQuestions,
    selectedOptions,
  };
}

export function createThinkingPartnerSpecBuilderIntent(output: ThinkingPartnerOutput): ThinkingPartnerSpecBuilderIntent {
  return createAddToSpecIntentFromSelections(output, {
    hypothesisIds: output.hypotheses.map((card) => card.id),
    questionIds: output.clarifyingQuestions.map((card) => card.id),
    optionIds: output.optionCards.filter((card) => card.recommended).map((card) => card.id),
  });
}

function selectById<T extends { id: string }>(items: T[], ids?: string[]): T[] {
  if (!ids || ids.length === 0) {
    return [];
  }
  const selectedIds = new Set(ids);
  return items.filter((item) => selectedIds.has(item.id));
}
