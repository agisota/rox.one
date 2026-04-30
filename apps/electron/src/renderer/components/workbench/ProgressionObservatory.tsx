import * as React from 'react';

import {
  createProgressionState,
  projectLeaderboardRows,
  type ProgressionState,
  type ProgressionStateInput,
} from './progression-observatory-state';

export interface ProgressionObservatoryProps {
  initialState?: ProgressionState;
  initialInput?: ProgressionStateInput;
}

export function ProgressionObservatory({ initialState, initialInput }: ProgressionObservatoryProps) {
  const [state] = React.useState<ProgressionState>(() => initialState ?? createProgressionState(initialInput));
  const visibleLeaderboardRows = projectLeaderboardRows(state);

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Progression Observatory">
      <header className="border-b border-border px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Experience Layer</p>
        <h1 className="mt-2 text-2xl font-semibold">Progression Observatory</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Track VDI, formulation quality, execution readiness, economy evidence, and leaderboard visibility without letting paid capacity alter quality metrics.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="text-sm font-semibold">Verified Deliverable Index</div>
            <div className="mt-2 text-4xl font-semibold">{state.latestSnapshot.verifiedDeliverableIndex}</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Evidence: {state.latestSnapshot.evidenceRefs.join(', ')}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <MetricCard label="Quality Score" value={`${state.latestSnapshot.qualityScore}`} />
            <MetricCard label="Execution Readiness" value={`${state.latestSnapshot.executionReadiness}`} />
            <MetricCard label="Cost Efficiency" value={`${state.latestSnapshot.costEfficiency}`} />
            <MetricCard label="Open Risk Score" value={`${state.latestSnapshot.openRiskScore}`} />
            <MetricCard label="Noise Score" value={`${state.latestSnapshot.noiseScore}`} />
            <MetricCard label="Swarm Capacity" value={`${state.capacity.swarmSlots} slots / ${state.capacity.maxMissionHours}h`} />
          </div>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <Panel title="Economy Ledger">
            {state.ledger.map((entry) => (
              <MetricRow key={entry.id} label={entry.reason} value={`${entry.amount} ${entry.currency}`} />
            ))}
          </Panel>

          <Panel title="Leaderboards">
            {visibleLeaderboardRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Leaderboards hidden by privacy policy.</p>
            ) : (
              visibleLeaderboardRows.map((row) => (
                <MetricRow key={row.id} label={row.displayName} value={`${row.score}`} />
              ))
            )}
          </Panel>

          <Panel title="Integrity Rules">
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>XP and unlocks require artifact or validation gate evidence.</li>
              <li>Paid capacity can increase slots and duration only.</li>
              <li>Quality Score and VDI remain evidence-backed metrics.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
