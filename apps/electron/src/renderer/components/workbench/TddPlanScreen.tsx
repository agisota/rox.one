import * as React from 'react';
import { renderTddTaskPackMarkdown } from '@craft-agent/shared/workbench';
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
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workbench Artifact</p>
            <h1 className="mt-2 text-2xl font-semibold">TDD Plan</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Convert the composer prompt into red, green, verify, and worklog tasks before execution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!state.canInsertPlan} onClick={() => onInsertPlan?.(renderTddTaskPackMarkdown(state.pack))}>
              Insert Plan
            </Button>
            <Button type="button" disabled={!state.canInsertPlan} onClick={() => onStartTdd?.(state)}>
              Start TDD
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border p-4 text-sm text-muted-foreground">
        <div>Ticket: {state.pack.ticketId}</div>
        <div>Validation gates: {state.pack.validationGates.join(', ')}</div>
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
        <h2 className="text-sm font-semibold">Fake providers required</h2>
        {state.pack.fakeProviderRequirements.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No fake providers required for the selected surfaces.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {state.pack.fakeProviderRequirements.map(requirement => <li key={requirement}>{requirement}</li>)}
          </ul>
        )}
      </aside>
    </main>
  );
}
