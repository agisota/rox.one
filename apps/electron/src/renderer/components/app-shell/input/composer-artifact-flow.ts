import { createDeterministicPromptRewriteProvider } from '@craft-agent/shared/workbench/prompt-rewrite-engine';
import type { ProductModeIntent } from './product-mode-toolbar';
import {
  createPromptLabState,
  createReviewGateState,
  createTddPlanState,
  type PromptLabState,
  type ReviewGateState,
  type TddPlanState,
} from '../../workbench/artifact-screen-state';
import {
  createSpecBuilderState,
  type SpecBuilderState,
} from '../../workbench/spec-builder-state';

export type ComposerArtifactKind = 'prompt-lab' | 'tdd-plan' | 'review-gate' | 'spec-builder';

export interface ComposerArtifactStateInput {
  intent: ProductModeIntent;
  rawInput: string;
}

export interface ComposerArtifactState {
  kind: ComposerArtifactKind;
  intent: ProductModeIntent;
  shouldSubmit: false;
  promptLab?: PromptLabState;
  tddPlan?: TddPlanState;
  reviewGate?: ReviewGateState;
  specBuilder?: SpecBuilderState;
}

export function shouldOpenComposerArtifactForIntent(intent: ProductModeIntent): boolean {
  return ['improve-prompt', 'run-tdd-plan', 'verify', 'tear-down', 'build-spec', 'review'].includes(intent.actionId);
}

export function createComposerArtifactState(input: ComposerArtifactStateInput): ComposerArtifactState {
  const rawInput = input.rawInput.trim();

  switch (input.intent.actionId) {
    case 'improve-prompt':
      return {
        kind: 'prompt-lab',
        intent: input.intent,
        shouldSubmit: false,
        promptLab: createPromptLabState(createPromptLabInput(rawInput, input.intent.mode)),
      };
    case 'run-tdd-plan':
      return {
        kind: 'tdd-plan',
        intent: input.intent,
        shouldSubmit: false,
        tddPlan: createTddPlanState({
          rawInput,
          ticketId: 'composer',
          title: 'Composer TDD Plan',
          modeId: 'tdd',
          validationGates: ['unit_tests', 'ui_tests'],
          touchedSurfaces: ['ui'],
        }),
      };
    case 'verify':
      return {
        kind: 'review-gate',
        intent: input.intent,
        shouldSubmit: false,
        reviewGate: createReviewGateState({
          rawInput,
          variant: 'check',
          requiredGates: ['logic_check', 'fact_check'],
        }),
      };
    case 'tear-down':
    case 'review':
      return {
        kind: 'review-gate',
        intent: input.intent,
        shouldSubmit: false,
        reviewGate: createReviewGateState({
          rawInput,
          variant: input.intent.actionId === 'tear-down' ? 'tear-down' : 'check',
          requiredGates: ['logic_check', 'fact_check', 'security_check'],
        }),
      };
    case 'build-spec':
      return {
        kind: 'spec-builder',
        intent: input.intent,
        shouldSubmit: false,
        specBuilder: createSpecBuilderState({
          source: 'manual',
          rawInput,
          modeId: 'spec',
        }),
      };
  }
}

function createPromptLabInput(rawInput: string, targetMode: ProductModeIntent['mode']): Parameters<typeof createPromptLabState>[0] {
  if (!rawInput) {
    return {
      rawInput,
      status: 'error',
      error: 'empty prompt',
    };
  }

  const output = createDeterministicPromptRewriteProvider().rewrite({
    originalPrompt: rawInput,
    rewriteStyle: 'build_ready',
    targetMode,
    constraints: [],
  });

  if (output instanceof Promise) {
    return {
      rawInput,
      status: 'error',
      error: 'prompt rewrite provider returned async output in sync composer flow',
    };
  }

  return {
    rawInput,
    status: 'success',
    output,
  };
}
