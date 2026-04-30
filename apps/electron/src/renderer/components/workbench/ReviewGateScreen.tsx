import * as React from 'react';
import { Button } from '../ui/button';
import type { ReviewGateState } from './artifact-screen-state';

export interface ReviewGateScreenProps {
  state: ReviewGateState;
  onApplyNotes?: (state: ReviewGateState) => void;
  onRunCheck?: (state: ReviewGateState) => void;
}

export function ReviewGateScreen({ state, onApplyNotes, onRunCheck }: ReviewGateScreenProps) {
  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Review Gate">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workbench Artifact</p>
            <h1 className="mt-2 text-2xl font-semibold">Review Gate</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Inspect factual, logical, security, and adversarial critique findings before execution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onRunCheck?.(state)}>Run Check</Button>
            <Button disabled={!state.canApplyNotes} onClick={() => onApplyNotes?.(state)}>Apply Notes</Button>
          </div>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border p-4" aria-label="Review Gate tabs">
        <span className={tabClass(state.activeTab === 'check')}>Проверка</span>
        <span className={tabClass(state.activeTab === 'tear-down')}>Разъебать</span>
        <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">Риски</span>
        <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">Acceptance</span>
      </nav>

      <section className="border-b border-border p-4 text-sm text-muted-foreground">
        Verdict: {state.result.verdict}. Findings: {state.result.findings.length}. Prompt: {state.rawInput || 'No prompt provided.'}
      </section>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Findings</h2>
          {state.result.findings.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/10 p-4 text-sm text-muted-foreground">No findings yet.</p>
          ) : (
            state.result.findings.map(finding => (
              <article key={finding.id} className="rounded-lg border border-border bg-background p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{finding.severity}</div>
                <h3 className="mt-2 text-sm font-semibold">{finding.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{finding.evidence}</p>
                <p className="mt-2 text-sm text-muted-foreground">{finding.recommendation}</p>
              </article>
            ))
          )}
        </section>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold">Checks</h2>
          {state.result.checks.map(check => (
            <section key={check.gateId} className="rounded-lg border border-border bg-muted/10 p-3">
              <div className="text-sm font-medium">{check.gateId}</div>
              <div className="mt-1 text-xs uppercase text-muted-foreground">{check.status}</div>
              <p className="mt-2 text-sm text-muted-foreground">{check.evidence}</p>
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}

function tabClass(active: boolean): string {
  return [
    'rounded-md border px-3 py-1.5 text-xs font-medium',
    active ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground',
  ].join(' ');
}
