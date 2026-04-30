import * as React from 'react';

import { Button } from '../ui/button';
import {
  DEEP_MISSION_PRESETS,
  createDeepMissionEntryState,
  selectDeepMissionPreset,
  type DeepMissionEntryState,
  type DeepMissionEntryStateInput,
  type DeepMissionPresetId,
} from './deep-missions-state';

export interface DeepMissionsScreenProps {
  initialState?: DeepMissionEntryState;
  initialInput?: DeepMissionEntryStateInput;
  onLaunchMission?: (state: DeepMissionEntryState) => void;
  onSaveDraft?: (state: DeepMissionEntryState) => void;
}

export function DeepMissionsScreen({
  initialState,
  initialInput,
  onLaunchMission,
  onSaveDraft,
}: DeepMissionsScreenProps) {
  const [state, setState] = React.useState<DeepMissionEntryState>(() =>
    initialState ?? createDeepMissionEntryState(initialInput),
  );

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Deep Missions">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Experience Layer</p>
            <h1 className="mt-2 text-2xl font-semibold">Deep Missions</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Configure a long-running mission with budget caps, checkpoint cadence, agent count, and a verified deliverable target before execution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onSaveDraft?.(state)}>
              Save Draft
            </Button>
            <Button disabled={!state.canLaunch} onClick={() => state.canLaunch && onLaunchMission?.(state)}>
              Launch Mission
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Run presets</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {DEEP_MISSION_PRESETS.map((preset) => {
                const selected = preset.id === state.presetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setState((current) => selectDeepMissionPreset(current, preset.id as DeepMissionPresetId))}
                    className={[
                      'rounded-xl border p-4 text-left transition-colors',
                      selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-muted/20 hover:bg-muted/50',
                    ].join(' ')}
                  >
                    <div className="text-sm font-semibold">{preset.label}</div>
                    <div className={['mt-2 text-sm', selected ? 'text-background/80' : 'text-muted-foreground'].join(' ')}>
                      {preset.description}
                    </div>
                    <div className={['mt-3 text-xs', selected ? 'text-background/70' : 'text-muted-foreground'].join(' ')}>
                      {preset.durationHours}h / every {preset.checkpointCadenceHours}h / {preset.recommendedAgentCount} agents
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="mt-4 rounded-xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Mission brief</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Mission types">
              {['Deep Run', 'Deep Reasoning Lab', 'Agenda Carnage', 'Swarm Arena', 'Proactive Watchtower'].map((modeLabel) => (
                <span key={modeLabel} className="rounded-full border border-border bg-muted/20 px-2.5 py-1">
                  {modeLabel}
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ReadOnlyField label="Title" value={state.title || 'Untitled mission'} />
              <ReadOnlyField label="Mode" value={formatMode(state.mode)} />
              <ReadOnlyField label="Layer" value={state.experienceLayer} />
              <ReadOnlyField label="VDI target" value={`${state.vdiTarget}`} />
            </div>
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Objective</div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {state.objective || 'No objective provided.'}
              </p>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Raw input</div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {state.rawInput || 'No mission input provided.'}
              </p>
            </div>
          </section>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Capacity and caps</h2>
            <MetricRow label="Budget cap" value={`${state.budgetCapCredits} credits`} />
            <MetricRow label="Token cap" value={`${state.tokenCap}`} />
            <MetricRow label="Storage cap" value={`${state.storageCapBytes} bytes`} />
            <MetricRow label="Selected agents" value={`${state.selectedAgentCount}`} />
          </section>

          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Checkpoint preview</h2>
            <ol className="mt-3 space-y-2">
              {state.checkpointPreview.map((checkpoint) => (
                <li key={`${checkpoint.ordinal}-${checkpoint.hour}`} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="text-sm font-medium">{checkpoint.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">hour {checkpoint.hour}</div>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Launch readiness</h2>
            {state.validationErrors.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Mission draft is ready for a fake scheduler handoff.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.validationErrors.map((error) => (
                  <li key={error} className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    {error}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function formatMode(mode: string): string {
  return mode
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}
