import * as React from 'react';
import { Button } from '../ui/button';
import type { PromptLabState } from './artifact-screen-state';

export interface PromptLabScreenProps {
  state: PromptLabState;
  onReplaceInput?: (prompt: string) => void;
  onSendToTddPlan?: (prompt: string) => void;
  onSendToSpec?: (prompt: string) => void;
}

export function PromptLabScreen({
  state,
  onReplaceInput,
  onSendToTddPlan,
  onSendToSpec,
}: PromptLabScreenProps) {
  const improvedPrompt = state.output?.rewrittenPrompt.trim() ?? '';

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Prompt Lab">
      <header className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Артефакт composer</p>
            <h1 className="mt-1 text-xl font-semibold">Prompt Lab</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Сравните исходный запрос с улучшенной версией, затем перенесите текст в composer или отправьте дальше в TDD/ТЗ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!state.canReplaceInput} onClick={() => onSendToTddPlan?.(improvedPrompt)}>
              В TDD Plan
            </Button>
            <Button type="button" variant="outline" disabled={!state.canReplaceInput} onClick={() => onSendToSpec?.(improvedPrompt)}>
              В ТЗ
            </Button>
            <Button type="button" disabled={!state.canReplaceInput} onClick={() => onReplaceInput?.(improvedPrompt)}>
              Заменить ввод
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-2">
        <section className="min-h-0 overflow-auto rounded-lg border border-border bg-background p-4">
          <h2 className="text-sm font-semibold">Исходный запрос</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{state.rawInput || 'Запрос еще не введен.'}</p>
        </section>
        <section className="min-h-0 overflow-auto rounded-lg border border-border bg-background p-4">
          <h2 className="text-sm font-semibold">Улучшенный запрос</h2>
          {state.status === 'error' ? (
            <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {state.error ?? 'Prompt Lab не смог подготовить улучшение без provider call.'}
            </p>
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{improvedPrompt || 'Улучшенный запрос еще не подготовлен.'}</p>
          )}
        </section>
      </div>

      {state.output && (
        <aside className="border-t border-border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <DetailList title="Предпосылки" values={state.output.assumptions} />
            <DetailList title="Acceptance criteria" values={state.output.acceptanceCriteria} />
            <DetailList title="Открытые вопросы" values={state.output.missingQuestions} />
          </div>
        </aside>
      )}
    </main>
  );
}

function DetailList({ title, values }: { title: string; values: readonly string[] }) {
  return (
    <section className="rounded-lg border border-border bg-muted/10 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h3>
      {values.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Нет.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
          {values.map(value => <li key={value}>{value}</li>)}
        </ul>
      )}
    </section>
  );
}
