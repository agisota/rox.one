import * as React from 'react';

import { Button } from '../ui/button';
import {
  createArenaBuilderState,
  createArenaDraftRun,
  toggleArenaAgentSelection,
  type ArenaAgentCollectionItem,
  type ArenaBuilderState,
  type ArenaBuilderStateInput,
  type ArenaDraftRun,
} from './arena-builder-state';

export interface ArenaBuilderScreenProps {
  initialState?: ArenaBuilderState;
  initialInput?: ArenaBuilderStateInput;
  onCreateDraftRun?: (draftRun: ArenaDraftRun) => void;
}

export function ArenaBuilderScreen({ initialState, initialInput, onCreateDraftRun }: ArenaBuilderScreenProps) {
  const [state, setState] = React.useState<ArenaBuilderState>(() => initialState ?? createArenaBuilderState(initialInput));
  const selectedAgents = state.selectedAgentPackageIds
    .map((id) => state.roster.find((agent) => agent.package.id === id))
    .filter((agent): agent is ArenaAgentCollectionItem => Boolean(agent));

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Arena Builder">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Experience Layer</p>
            <h1 className="mt-2 text-2xl font-semibold">Arena Builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Build a swarm from trusted agent packages. Arena presentation can raise intensity, but validation gates and trust checks stay fixed.
            </p>
          </div>
          <Button
            disabled={!state.canCreateDraft}
            onClick={() => state.canCreateDraft && onCreateDraftRun?.(createArenaDraftRun(state))}
          >
            Create Draft Run
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Agent Collection</h2>
              <p className="mt-1 text-sm text-muted-foreground">Select unlocked agents for the current swarm draft.</p>
            </div>
            <div className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              {state.runEstimate.swarmSlotsUsed} / {state.runEstimate.swarmSlotLimit} slots
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {state.roster.map((agent) => {
              const selected = state.selectedAgentPackageIds.includes(agent.package.id);
              return (
                <button
                  key={agent.package.id}
                  type="button"
                  aria-pressed={selected}
                  aria-disabled={!agent.unlocked}
                  onClick={() => setState((current) => toggleArenaAgentSelection(current, agent.package.id))}
                  className={[
                    'rounded-xl border p-4 text-left transition-colors',
                    selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-background hover:bg-muted/30',
                    agent.unlocked ? '' : 'opacity-70',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{agent.package.name}</div>
                      <div className={['mt-1 text-xs', selected ? 'text-background/70' : 'text-muted-foreground'].join(' ')}>
                        {agent.roleTag} / {agent.package.rarity} / level {agent.level}
                      </div>
                    </div>
                    <span className={['rounded-full border px-2 py-0.5 text-xs', selected ? 'border-background/30' : 'border-border'].join(' ')}>
                      {agent.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p className={['mt-3 text-sm', selected ? 'text-background/80' : 'text-muted-foreground'].join(' ')}>
                    {agent.package.description}
                  </p>
                  <div className={['mt-3 grid gap-2 text-xs sm:grid-cols-3', selected ? 'text-background/75' : 'text-muted-foreground'].join(' ')}>
                    <span>Trust {agent.package.trustScore}</span>
                    <span>Mastery {agent.masteryPercent}%</span>
                    <span>{agent.baseCostCredits} credits</span>
                  </div>
                  {!agent.unlocked && (
                    <div className={['mt-3 text-xs', selected ? 'text-background/70' : 'text-muted-foreground'].join(' ')}>
                      Unlock: {agent.unlockCriteria.join(' + ')}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Selected Agents</h2>
            {selectedAgents.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No agents selected.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {selectedAgents.map((agent) => (
                  <li key={agent.package.id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="text-sm font-medium">{agent.package.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {agent.roleTag} / trust {agent.package.trustScore} / {agent.baseCostCredits} credits
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Budget Estimate</h2>
            <MetricRow label="Credits" value={`${state.runEstimate.budgetEstimateCredits}`} />
            <MetricRow label="Expected contributions" value={`${state.runEstimate.estimatedContributionCount}`} />
            <MetricRow label="Trust floor" value={`${state.runEstimate.trustFloor}`} />
            <MetricRow label="Required gates" value={state.runEstimate.validationGateIds.join(', ')} />
          </section>

          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Selection Warnings</h2>
            {state.selectionWarnings.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No warnings. Capacity and locks are respected.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.selectionWarnings.map((warning) => (
                  <li key={warning} className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    {warning}
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
