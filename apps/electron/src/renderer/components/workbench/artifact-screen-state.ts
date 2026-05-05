import type { PromptRewriteOutput } from '@craft-agent/shared/workbench';
import {
  runReviewBoard,
  type ReviewBoardEvidence,
  type ReviewBoardResult,
} from '@craft-agent/shared/workbench/review-board';
import {
  generateTddTaskPack,
  type TddTaskPack,
} from '@craft-agent/shared/workbench';
import type { ProductMode, ValidationGate } from '@craft-agent/shared/workbench/product-mode-registry';

export type ArtifactScreenStatus = 'idle' | 'success' | 'error';

export interface PromptLabState {
  rawInput: string;
  status: ArtifactScreenStatus;
  output?: PromptRewriteOutput;
  error?: string;
  canReplaceInput: boolean;
}

export interface PromptLabStateInput {
  rawInput: string;
  status?: ArtifactScreenStatus;
  output?: PromptRewriteOutput;
  error?: string;
}

export interface TddPlanStateInput {
  rawInput: string;
  ticketId?: string;
  title?: string;
  modeId?: ProductMode;
  validationGates?: ValidationGate[];
  touchedSurfaces?: string[];
}

export interface TddPlanState {
  rawInput: string;
  pack: TddTaskPack;
  canInsertPlan: boolean;
}

export type ReviewGateVariant = 'check' | 'tear-down';

export interface ReviewGateStateInput {
  rawInput: string;
  variant?: ReviewGateVariant;
  requiredGates?: ValidationGate[];
  evidence?: ReviewBoardEvidence[];
}

export interface ReviewGateState {
  rawInput: string;
  activeTab: ReviewGateVariant;
  result: ReviewBoardResult;
  canApplyNotes: boolean;
}

export function createPromptLabState(input: PromptLabStateInput): PromptLabState {
  const rawInput = input.rawInput.trim();
  const status = input.status ?? (input.output ? 'success' : 'idle');

  return {
    rawInput,
    status,
    output: input.output,
    error: input.error,
    canReplaceInput: status === 'success' && Boolean(input.output?.rewrittenPrompt.trim()),
  };
}

export function createTddPlanState(input: TddPlanStateInput): TddPlanState {
  const rawInput = input.rawInput.trim();
  const pack = generateTddTaskPack({
    ticketId: input.ticketId ?? 'composer',
    title: input.title ?? 'Composer TDD Plan',
    rawInput: rawInput || 'No prompt provided',
    modeId: input.modeId ?? 'tdd',
    validationGates: input.validationGates ?? ['unit_tests', 'ui_tests'],
    touchedSurfaces: input.touchedSurfaces ?? ['ui'],
    createdAt: '2026-04-30T00:00:00.000Z',
  });

  return {
    rawInput,
    pack,
    canInsertPlan: rawInput.length > 0,
  };
}

export function createReviewGateState(input: ReviewGateStateInput): ReviewGateState {
  const rawInput = input.rawInput.trim();
  const requiredGates = input.requiredGates ?? ['logic_check', 'fact_check', 'security_check'];
  const result = runReviewBoard({
    boardId: 'composer-review-gate',
    title: input.variant === 'tear-down' ? 'Adversarial Review Gate' : 'Review Gate',
    requiredGates,
    reviewers: [
      { id: 'logic-critic', label: 'Logic critic', gateIds: ['logic_check'] },
      { id: 'fact-checker', label: 'Fact checker', gateIds: ['fact_check'] },
      { id: 'security-reviewer', label: 'Security reviewer', gateIds: ['security_check'] },
      { id: 'completion-verifier', label: 'Completion verifier', gateIds: ['unit_tests', 'ui_tests', 'schema'] },
    ],
    artifacts: [
      {
        artifactId: 'composer-prompt',
        artifactType: 'prompt',
        title: 'Composer prompt',
        content: rawInput || 'No prompt provided',
        sources: [],
        protected: false,
      },
    ],
    evidence: input.evidence ?? [],
  });

  return {
    rawInput,
    activeTab: input.variant ?? 'check',
    result,
    canApplyNotes: result.findings.length > 0,
  };
}
