import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { ThinkingPartnerOutput } from '@rox-one/shared/workbench/thinking-partner';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { useRegisterModal } from '../../../context/ModalContext';

export type ThinkingPartnerDialogStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ThinkingPartnerRoundTableSelection {
  hypothesisIds: string[];
  questionIds: string[];
  optionIds: string[];
}

export interface ThinkingPartnerRoundTableDialogProps {
  open: boolean;
  status: ThinkingPartnerDialogStatus;
  output?: ThinkingPartnerOutput;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onRetry?: () => void;
  onAddToSpec: (output: ThinkingPartnerOutput, selection: ThinkingPartnerRoundTableSelection) => void;
  onGenerateSpec: (output: ThinkingPartnerOutput) => void;
}

export function ThinkingPartnerRoundTableDialog({
  open,
  status,
  output,
  error,
  onOpenChange,
  onRetry,
  onAddToSpec,
  onGenerateSpec,
}: ThinkingPartnerRoundTableDialogProps) {
  const { t } = useTranslation();
  const [selection, setSelection] = React.useState<ThinkingPartnerRoundTableSelection>({
    hypothesisIds: [],
    questionIds: [],
    optionIds: [],
  });

  React.useEffect(() => {
    setSelection({
      hypothesisIds: output?.hypotheses.map((card) => card.id) ?? [],
      questionIds: [],
      optionIds: output?.optionCards.filter((card) => card.recommended).map((card) => card.id) ?? [],
    });
  }, [output]);

  useRegisterModal(open, () => onOpenChange(false));

  const canUseOutput = status === 'success' && output != null;
  const selectedCount = selection.hypothesisIds.length + selection.questionIds.length + selection.optionIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('workbench.thinking.dialog.title')}</DialogTitle>
          <DialogDescription>{t('workbench.thinking.dialog.description')}</DialogDescription>
        </DialogHeader>

        {status === 'loading' ? (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t('workbench.thinking.loading')}
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-medium">{t('workbench.thinking.errorTitle')}</div>
            <div>{error ?? t('workbench.thinking.errors.providerFailed')}</div>
          </div>
        ) : null}

        {canUseOutput ? (
          <div className="space-y-5">
            <section className="rounded-xl border border-border bg-muted/20 p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {t('workbench.thinking.problemFrame')}
              </h3>
              <p className="text-sm leading-6">{output.problemFrame}</p>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('workbench.thinking.roles')}</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {output.roleCards.map((card) => (
                  <article key={card.roleId} className="rounded-xl border border-border bg-background p-4">
                    <h4 className="text-sm font-semibold">{card.title}</h4>
                    <p className="mt-2 text-sm text-muted-foreground">{card.summary}</p>
                    <p className="mt-3 text-sm">{card.recommendation}</p>
                  </article>
                ))}
              </div>
            </section>

            <SelectableCardSection
              title={t('workbench.thinking.hypotheses')}
              items={output.hypotheses.map((card) => ({
                id: card.id,
                title: card.claim,
                body: `${card.evidence}\n${card.risk}\n${card.nextAction}`,
              }))}
              selectedIds={selection.hypothesisIds}
              onToggle={(id) => setSelection((current) => toggleSelection(current, 'hypothesisIds', id))}
            />

            <SelectableCardSection
              title={t('workbench.thinking.questions')}
              items={output.clarifyingQuestions.map((card) => ({
                id: card.id,
                title: card.question,
                body: `${card.priority.toUpperCase()} · ${card.rationale}`,
              }))}
              selectedIds={selection.questionIds}
              onToggle={(id) => setSelection((current) => toggleSelection(current, 'questionIds', id))}
            />

            <SelectableCardSection
              title={t('workbench.thinking.options')}
              items={output.optionCards.map((card) => ({
                id: card.id,
                title: card.label,
                body: `${card.description}\n${card.tradeoff}`,
              }))}
              selectedIds={selection.optionIds}
              onToggle={(id) => setSelection((current) => toggleSelection(current, 'optionIds', id))}
            />
          </div>
        ) : null}

        <DialogFooter>
          {status === 'error' && onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              {t('workbench.thinking.retry')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {canUseOutput ? (
            <Button variant="outline" disabled={selectedCount === 0} onClick={() => onAddToSpec(output, selection)}>
              {t('workbench.thinking.addToSpec')}
            </Button>
          ) : null}
          {canUseOutput ? (
            <Button onClick={() => onGenerateSpec(output)}>
              {t('workbench.thinking.generateSpec')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectableCardSection({
  title,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  items: Array<{ id: string; title: string; body: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => {
          const selected = selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(item.id)}
              className={[
                'rounded-xl border p-4 text-left transition-colors',
                selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:bg-muted/50',
              ].join(' ')}
            >
              <div className="text-sm font-semibold">{item.title}</div>
              <div className={['mt-2 whitespace-pre-line text-sm', selected ? 'text-background/80' : 'text-muted-foreground'].join(' ')}>
                {item.body}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function toggleSelection(
  current: ThinkingPartnerRoundTableSelection,
  key: keyof ThinkingPartnerRoundTableSelection,
  id: string,
): ThinkingPartnerRoundTableSelection {
  const selected = new Set(current[key]);
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }

  return {
    ...current,
    [key]: Array.from(selected),
  };
}
