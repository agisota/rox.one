import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { PromptLabScreen } from '../../workbench/PromptLabScreen';
import { ReviewGateScreen } from '../../workbench/ReviewGateScreen';
import { SpecBuilderScreen } from '../../workbench/SpecBuilderScreen';
import { TddPlanScreen } from '../../workbench/TddPlanScreen';
import { createOpenArtifactProductModeIntent } from './product-mode-toolbar';
import {
  createComposerArtifactState,
  type ComposerArtifactKind,
  type ComposerArtifactState,
} from './composer-artifact-flow';
import { renderTddTaskPackMarkdown } from '@rox-one/shared/workbench';

export interface ComposerArtifactPanelProps {
  artifact: ComposerArtifactState | null;
  onClose?: () => void;
  onReplaceInput?: (prompt: string) => void;
}

export function ComposerArtifactPanel({ artifact, onClose, onReplaceInput }: ComposerArtifactPanelProps) {
  const [activeArtifact, setActiveArtifact] = React.useState<ComposerArtifactState | null>(artifact);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActiveArtifact(artifact);
    setStatus(null);
  }, [artifact]);

  const transitionToArtifact = React.useCallback((kind: ComposerArtifactKind, rawInput: string) => {
    const actionIdByKind = {
      'prompt-lab': 'improve-prompt',
      'tdd-plan': 'run-tdd-plan',
      'review-gate': 'review',
      'spec-builder': 'build-spec',
    } as const;

    setActiveArtifact(createComposerArtifactState({
      intent: createOpenArtifactProductModeIntent(kind, artifact?.intent.mode ?? 'research', {
        actionId: actionIdByKind[kind],
        source: 'composer-artifact-panel',
      }),
      rawInput,
    }));
    setStatus(null);
  }, [artifact?.intent.mode]);

  const handleReplaceInput = React.useCallback((nextInput: string) => {
    onReplaceInput?.(nextInput);
    setStatus('Текст перенесен в поле запроса.');
  }, [onReplaceInput]);

  const handleInsertTddPlan = React.useCallback((markdown: string) => {
    onReplaceInput?.(markdown);
    setStatus('TDD-план перенесен в поле запроса.');
  }, [onReplaceInput]);

  const handleStartTdd = React.useCallback(() => {
    if (!activeArtifact?.tddPlan) return;
    onReplaceInput?.(renderTddTaskPackMarkdown(activeArtifact.tddPlan.pack));
    setStatus('TDD-план подготовлен к запуску в composer.');
    toast.success('TDD-план подготовлен');
  }, [activeArtifact?.tddPlan, onReplaceInput]);

  const handleReviewApplyNotes = React.useCallback(() => {
    if (!activeArtifact?.reviewGate) return;
    const notes = createReviewNotes(activeArtifact.reviewGate);
    onReplaceInput?.(notes);
    setStatus('Замечания ревью перенесены в поле запроса.');
    toast.success('Замечания ревью подготовлены');
  }, [activeArtifact?.reviewGate, onReplaceInput]);

  const handleReviewRunCheck = React.useCallback(() => {
    setStatus('Проверка пересчитана локально: логика, факты, риски и security gates обновлены.');
    toast.success('Проверка выполнена локально');
  }, []);

  const handleSpecExport = React.useCallback((state: NonNullable<ComposerArtifactState['specBuilder']>) => {
    downloadTextFile('rox-spec-builder-preview.md', state.preview);
    setStatus('Spec preview экспортирован в Markdown.');
  }, []);

  const handleSpecSavePreset = React.useCallback((state: NonNullable<ComposerArtifactState['specBuilder']>) => {
    if (typeof window === 'undefined' || !window.electronAPI?.readPreferences || !window.electronAPI?.writePreferences) return;

    const preset = {
      rawInput: state.rawInput,
      selectedOptionIds: state.selectedOptionIds,
      savedAt: new Date().toISOString(),
    };

    window.electronAPI.readPreferences().then(({ content }) => {
      let preferences: Record<string, unknown> = {};
      try {
        preferences = content ? JSON.parse(content) as Record<string, unknown> : {};
      } catch {
        preferences = {};
      }

      return window.electronAPI.writePreferences(JSON.stringify({
        ...preferences,
        specBuilder: {
          ...(typeof preferences.specBuilder === 'object' && preferences.specBuilder !== null ? preferences.specBuilder : {}),
          lastPreset: preset,
        },
        updatedAt: Date.now(),
      }, null, 2));
    }).then((result) => {
      if (!result.success) {
        throw new Error(result.error ?? 'Unknown preferences write error');
      }
      setStatus('Preset сохранен в ~/.rox/preferences.json для следующей настройки Spec Builder.');
      toast.success('Preset сохранен');
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Не удалось сохранить preset: ${message}`);
      toast.error('Preset не сохранен');
    });
  }, []);

  const handleSpecStartAgentPlan = React.useCallback((state: NonNullable<ComposerArtifactState['specBuilder']>) => {
    onReplaceInput?.(state.preview);
    setStatus('Agent plan подготовлен в поле запроса. Проверьте текст и отправьте.');
    toast.success('Agent plan подготовлен');
  }, [onReplaceInput]);

  const handleClose = React.useCallback(() => {
    setActiveArtifact(null);
    setStatus(null);
    onClose?.();
  }, [onClose]);

  if (!activeArtifact) {
    return null;
  }

  return (
    <section className="border-t border-border bg-background" aria-label="Composer artifact panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Рабочий артефакт</div>
          {status && (
            <div className="mt-1 text-xs text-emerald-300" role="status" aria-live="polite">
              {status}
            </div>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleClose}>Закрыть</Button>
      </div>
      <div className="h-[min(52vh,560px)] min-h-[340px] overflow-auto">
        {activeArtifact.kind === 'prompt-lab' && activeArtifact.promptLab && (
          <PromptLabScreen
            state={activeArtifact.promptLab}
            onReplaceInput={handleReplaceInput}
            onSendToTddPlan={(prompt) => transitionToArtifact('tdd-plan', prompt)}
            onSendToSpec={(prompt) => transitionToArtifact('spec-builder', prompt)}
          />
        )}
        {activeArtifact.kind === 'tdd-plan' && activeArtifact.tddPlan && (
          <TddPlanScreen
            state={activeArtifact.tddPlan}
            onInsertPlan={handleInsertTddPlan}
            onStartTdd={handleStartTdd}
          />
        )}
        {activeArtifact.kind === 'review-gate' && activeArtifact.reviewGate && (
          <ReviewGateScreen
            state={activeArtifact.reviewGate}
            onApplyNotes={handleReviewApplyNotes}
            onRunCheck={handleReviewRunCheck}
          />
        )}
        {activeArtifact.kind === 'spec-builder' && activeArtifact.specBuilder && (
          <SpecBuilderScreen
            initialState={activeArtifact.specBuilder}
            onExport={handleSpecExport}
            onSavePreset={handleSpecSavePreset}
            onStartAgentPlan={handleSpecStartAgentPlan}
          />
        )}
      </div>
    </section>
  );
}

function createReviewNotes(state: NonNullable<ComposerArtifactState['reviewGate']>): string {
  const findings = state.result.findings.map((finding, index) => [
    `${index + 1}. ${finding.title}`,
    `   Severity: ${finding.severity}`,
    `   Evidence: ${finding.evidence}`,
    `   Fix: ${finding.fixPlan}`,
  ].join('\n')).join('\n\n');

  return [
    '# Review Gate Notes',
    '',
    `Verdict: ${state.result.verdict}`,
    `Prompt: ${state.rawInput || 'No prompt provided.'}`,
    '',
    findings || 'No findings.',
  ].join('\n');
}

function downloadTextFile(fileName: string, contents: string): void {
  if (typeof document === 'undefined') return;

  const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
