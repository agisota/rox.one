import * as React from 'react';

import { Button } from '../ui/button';
import {
  approveMissionBranch,
  createMissionControlState,
  transitionMissionCheckpoint,
  type MissionControlState,
} from './mission-control-state';

export interface MissionControlRunDetailProps {
  initialState?: MissionControlState;
}

export function MissionControlRunDetail({ initialState }: MissionControlRunDetailProps) {
  const [state, setState] = React.useState<MissionControlState>(() => initialState ?? createMissionControlState());

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Mission Control">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Mission Control</p>
            <h1 className="mt-2 text-2xl font-semibold">{state.mission.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{state.mission.objective}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Final pass</div>
            <div className="mt-1 text-lg font-semibold">{state.canFinalize ? 'Ready' : 'Blocked'}</div>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <h2 className="text-sm font-semibold">Active Run Timeline</h2>
          <ol className="mt-4 space-y-3">
            {state.checkpoints.map((checkpoint) => (
              <li key={checkpoint.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{checkpoint.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {checkpoint.id} / {checkpoint.status} / VDI delta {checkpoint.vdiDelta}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setState((current) => transitionMissionCheckpoint(current, checkpoint.id, 'completed'))}
                  >
                    Mark Complete
                  </Button>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{checkpoint.summary}</div>
              </li>
            ))}
          </ol>

          <section className="mt-4 rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Swarm Feed</h2>
            <div className="mt-3 space-y-2">
              {state.feedItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-sm font-medium">{item.source}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.checkpointId} / {item.severity}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <Panel title="Validation Gates">
            {state.gateResults.map((gate) => (
              <MetricRow
                key={gate.gateId}
                label={gate.gateId}
                value={`${gate.status}${gate.blocking ? ' / blocking' : ''}`}
              />
            ))}
          </Panel>

          <Panel title="Human Approvals">
            {state.approvals.map((approval) => (
              <div key={approval.id} className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-sm font-medium">{approval.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{approval.status}</div>
                <p className="mt-2 text-sm text-muted-foreground">{approval.description}</p>
                {approval.status === 'pending' && (
                  <Button
                    className="mt-3"
                    variant="outline"
                    onClick={() => setState((current) => approveMissionBranch(current, approval.id))}
                  >
                    Approve Branch
                  </Button>
                )}
              </div>
            ))}
          </Panel>

          <Panel title="Interim Artifacts">
            {state.artifacts.map((artifact) => (
              <MetricRow
                key={artifact.id}
                label={artifact.title}
                value={`${artifact.checkpointId} / ${artifact.validationState}`}
              />
            ))}
          </Panel>

          <Panel title="Audit and Billing Trace">
            {state.auditEvents.map((event) => (
              <MetricRow key={event.id} label={event.summary} value={event.createdAt} />
            ))}
            {state.billingTrace.map((item) => (
              <MetricRow key={item.id} label={item.label} value={`${item.credits} credits / ${item.source}`} />
            ))}
          </Panel>

          <Panel title="Blocking Reasons">
            {state.blockingReasons.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No blockers.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.blockingReasons.map((reason) => (
                  <li key={reason} className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
