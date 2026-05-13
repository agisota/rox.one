import * as React from 'react';
import { renderTddTaskPackMarkdown } from '@rox-one/shared/workbench';
import { Button } from '../ui/button';
import type { TddPlanState } from './artifact-screen-state';

export interface TddPlanScreenProps {
  state: TddPlanState;
  onInsertPlan?: (markdown: string) => void;
  onStartTdd?: (state: TddPlanState) => void;
}

const PHASE_LABELS = {
  red: 'RED',
  green: 'GREEN',
  verify: 'VERIFY',
  worklog: 'WORKLOG',
} as const;

export function TddPlanScreen({ state, onInsertPlan, onStartTdd }: TddPlanScreenProps) {
  const tasksByPhase = state.pack.tasks;

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="TDD Plan">
      <header className="border-b border-border px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Артефакт composer</p>
            <h1 className="mt-1 text-xl font-semibold">TDD Plan</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Разложите запрос на RED, GREEN, VERIFY и WORKLOG задачи до запуска агента.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!state.canInsertPlan} onClick={() => onInsertPlan?.(renderTddTaskPackMarkdown(state.pack))}>
              Вставить план
            </Button>
            <Button type="button" disabled={!state.canInsertPlan} onClick={() => onStartTdd?.(state)}>
              Подготовить запуск
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border p-4 text-sm text-muted-foreground">
        <div>Ticket: {state.pack.ticketId}</div>
        <div>Проверки: {state.pack.validationGates.join(', ')}</div>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-4 xl:grid-cols-4">
        {tasksByPhase.map(task => (
          <section key={task.id} className="rounded-lg border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">{PHASE_LABELS[task.phase]}</h2>
            <p className="mt-2 text-sm font-medium">{task.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
            {task.checkCommands.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {task.checkCommands.map(command => <li key={command}>{command}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>

      <aside className="border-t border-border p-4">
        <h2 className="text-sm font-semibold">Нужные fake providers</h2>
        {state.pack.fakeProviderRequirements.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Для выбранных поверхностей fake providers не требуются.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {state.pack.fakeProviderRequirements.map(requirement => <li key={requirement}>{requirement}</li>)}
          </ul>
        )}
      </aside>
    </main>
  );
}
