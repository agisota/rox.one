import * as React from 'react';
import { Button } from '../../ui/button';
import { PromptLabScreen } from '../../workbench/PromptLabScreen';
import { ReviewGateScreen } from '../../workbench/ReviewGateScreen';
import { SpecBuilderScreen } from '../../workbench/SpecBuilderScreen';
import { TddPlanScreen } from '../../workbench/TddPlanScreen';
import type { ComposerArtifactState } from './composer-artifact-flow';

export interface ComposerArtifactPanelProps {
  artifact: ComposerArtifactState | null;
  onClose?: () => void;
  onReplaceInput?: (prompt: string) => void;
}

export function ComposerArtifactPanel({ artifact, onClose, onReplaceInput }: ComposerArtifactPanelProps) {
  if (!artifact) {
    return null;
  }

  return (
    <section className="border-t border-border bg-background" aria-label="Composer artifact panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="text-xs font-medium text-muted-foreground">In-app artifact</div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="max-h-[72vh] min-h-[360px] overflow-auto">
        {artifact.kind === 'prompt-lab' && artifact.promptLab && (
          <PromptLabScreen state={artifact.promptLab} onReplaceInput={onReplaceInput} />
        )}
        {artifact.kind === 'tdd-plan' && artifact.tddPlan && (
          <TddPlanScreen state={artifact.tddPlan} onInsertPlan={onReplaceInput} />
        )}
        {artifact.kind === 'review-gate' && artifact.reviewGate && (
          <ReviewGateScreen state={artifact.reviewGate} />
        )}
        {artifact.kind === 'spec-builder' && artifact.specBuilder && (
          <SpecBuilderScreen initialState={artifact.specBuilder} />
        )}
      </div>
    </section>
  );
}
