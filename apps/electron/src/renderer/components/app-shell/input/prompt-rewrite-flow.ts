import type { PromptRewriteOutput, PromptRewriteRequest } from '@rox-one/shared/workbench';
import type { ProductMode, ProductModeIntent } from './product-mode-toolbar';

export const PROMPT_REWRITE_SPEC_BUILDER_EVENT = 'craft:spec-builder-intent';

export interface PromptRewriteSpecBuilderIntent {
  type: 'spec-builder-intent';
  source: 'prompt-rewrite';
  targetMode: 'spec';
  labels: ['mode::rewrite', 'artifact::prompt'];
  rewriteOutput: PromptRewriteOutput;
}

export function shouldOpenPromptRewriteForIntent(intent: ProductModeIntent): boolean {
  return intent.behavior !== 'wrap-prompt' && intent.actionId === 'improve-prompt';
}

export function createPromptRewriteRequestFromComposer(
  composerInput: string,
  targetMode: ProductMode,
): PromptRewriteRequest {
  const originalPrompt = composerInput.trim();

  if (!originalPrompt) {
    throw new Error('empty prompt');
  }

  return {
    originalPrompt,
    rewriteStyle: 'build_ready',
    targetMode,
    constraints: [],
  };
}

export function applyPromptRewriteAcceptance(output: PromptRewriteOutput, editedPrompt?: string): string {
  const acceptedPrompt = editedPrompt?.trim() || output.rewrittenPrompt.trim();

  if (!acceptedPrompt) {
    throw new Error('empty rewritten prompt');
  }

  return acceptedPrompt;
}

export function createSpecBuilderIntentFromRewrite(output: PromptRewriteOutput): PromptRewriteSpecBuilderIntent {
  return {
    type: 'spec-builder-intent',
    source: 'prompt-rewrite',
    targetMode: 'spec',
    labels: ['mode::rewrite', 'artifact::prompt'],
    rewriteOutput: output,
  };
}
