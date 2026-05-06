import { createDeterministicPromptRewriteProvider } from '@rox-agent/shared/workbench/prompt-rewrite-engine';
import type { ExperienceEvent } from '@rox-agent/shared/workbench';
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

export interface ComposerExperienceEventContext {
  createdAt: string;
  actorId?: string;
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

export function createExperienceEventsForComposerArtifact(
  state: ComposerArtifactState,
  context: ComposerExperienceEventContext,
): ExperienceEvent[] {
  const createdAt = context.createdAt;
  const actorId = context.actorId;
  const baseId = createStableArtifactId(`${state.kind}:${state.intent.actionId}:${state.intent.mode}:${getArtifactRawInput(state)}`);
  const sourceArtifactId = `${baseId}-source`;
  const artifactId = `${baseId}-artifact`;

  switch (state.kind) {
    case 'prompt-lab': {
      if (state.promptLab?.status !== 'success' || !state.promptLab.output?.rewrittenPrompt.trim()) return [];
      return [
        {
          id: `${baseId}-prompt-submitted`,
          type: 'prompt.submitted',
          createdAt,
          actorId,
          payload: {
            artifactId: sourceArtifactId,
            rawPrompt: state.promptLab.rawInput,
          },
        },
        {
          id: `${baseId}-prompt-rewritten`,
          type: 'prompt.rewritten',
          createdAt,
          actorId,
          payload: {
            artifactId,
            sourceArtifactId,
            rewrittenPrompt: state.promptLab.output.rewrittenPrompt,
          },
        },
      ];
    }
    case 'spec-builder':
      if (!state.specBuilder?.rawInput.trim()) return [];
      return [
        {
          id: `${baseId}-spec-compiled`,
          type: 'spec.compiled',
          createdAt,
          actorId,
          payload: {
            artifactId,
            sourceArtifactId,
            title: 'Composer Spec Builder',
          },
        },
      ];
    case 'tdd-plan':
      if (!state.tddPlan?.rawInput.trim()) return [];
      return [
        {
          id: `${baseId}-tdd-plan-created`,
          type: 'tdd.plan.created',
          createdAt,
          actorId,
          payload: {
            artifactId,
            sourceArtifactId,
          },
        },
      ];
    case 'review-gate': {
      if (!state.reviewGate) return [];
      const failedCheck = state.reviewGate.result.checks.find((check) => check.status === 'fail');
      const warnedCheck = state.reviewGate.result.checks.find((check) => check.status === 'warn');
      const selectedCheck = failedCheck ?? warnedCheck ?? state.reviewGate.result.checks[0];
      const gateEvidenceRef = `gate:composer:${selectedCheck.gateId}:${selectedCheck.status}`;
      const events: ExperienceEvent[] = [
        {
          id: `${baseId}-review-completed`,
          type: 'review.completed',
          createdAt,
          actorId,
          payload: {
            artifactId,
            gateEvidenceRefs: [gateEvidenceRef],
            findingCount: state.reviewGate.result.findings.length,
          },
        },
      ];

      if (selectedCheck.status !== 'pass') {
        events.push({
          id: `${baseId}-gate-${selectedCheck.status}`,
          type: selectedCheck.status === 'fail' ? 'gate.failed' : 'gate.warned',
          createdAt,
          actorId,
          payload: {
            gateId: selectedCheck.gateId,
            evidenceRef: gateEvidenceRef,
            blocking: selectedCheck.status === 'fail',
          },
        });
      }

      return events;
    }
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

function getArtifactRawInput(state: ComposerArtifactState): string {
  return state.promptLab?.rawInput ?? state.specBuilder?.rawInput ?? state.tddPlan?.rawInput ?? state.reviewGate?.rawInput ?? '';
}

function createStableArtifactId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `composer-${stateKindPrefix(input)}-${hash.toString(36)}`;
}

function stateKindPrefix(input: string): string {
  return input.split(':')[0]?.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'artifact';
}
