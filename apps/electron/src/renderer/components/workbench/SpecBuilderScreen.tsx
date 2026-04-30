import * as React from 'react';
import { Button } from '../ui/button';
import {
  clearSpecBuilderOptions,
  createSpecBuilderState,
  toggleSpecBuilderOption,
  type SpecBuilderState,
  type SpecBuilderStateInput,
} from './spec-builder-state';

export interface SpecBuilderScreenProps {
  initialState?: SpecBuilderState;
  initialInput?: SpecBuilderStateInput;
  onStartAgentPlan?: (state: SpecBuilderState) => void;
  onExport?: (state: SpecBuilderState) => void;
  onSavePreset?: (state: SpecBuilderState) => void;
}

export function SpecBuilderScreen({
  initialState,
  initialInput,
  onStartAgentPlan,
  onExport,
  onSavePreset,
}: SpecBuilderScreenProps) {
  const [state, setState] = React.useState<SpecBuilderState>(() =>
    initialState ??
    createSpecBuilderState(
      initialInput ?? {
        source: 'manual',
        rawInput: '',
        modeId: 'spec',
      },
    ),
  );

  const selectedSet = React.useMemo(() => new Set(state.selectedOptionIds), [state.selectedOptionIds]);

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Spec Builder">
      <header className="border-b border-border px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Agent Workbench</p>
            <h1 className="mt-2 text-2xl font-semibold">Spec Builder</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Select requirement cards, inspect the derived skills, agents, validation gates, and preview an executable spec before agent execution.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!state.canExport} onClick={() => onExport?.(state)}>
              Export
            </Button>
            <Button variant="outline" onClick={() => onSavePreset?.(state)}>
              Save Preset
            </Button>
            <Button disabled={!state.canExport} onClick={() => onStartAgentPlan?.(state)}>
              Start Agent Plan
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Input summary</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {state.rawInput || 'No input yet. Open from Rewrite Prompt, Thinking Partner, or start manually.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-1">source: {state.source}</span>
              <span className="rounded-full border border-border px-2 py-1">mode: {state.modeId}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Option categories</h2>
            <Button variant="ghost" size="sm" onClick={() => setState((current) => clearSpecBuilderOptions(current))}>
              Clear
            </Button>
          </div>

          <div className="mt-3 space-y-4">
            {state.categoryGroups.map((group) => (
              <section key={group.category} className="rounded-xl border border-border bg-background p-4">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {group.options.map((option) => {
                    const selected = selectedSet.has(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setState((current) => toggleSpecBuilderOption(current, option.id))}
                        className={[
                          'rounded-xl border p-4 text-left transition-colors',
                          selected ? 'border-foreground bg-foreground text-background' : 'border-border bg-muted/20 hover:bg-muted/50',
                        ].join(' ')}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className={['mt-2 text-sm', selected ? 'text-background/80' : 'text-muted-foreground'].join(' ')}>
                          {option.description}
                        </div>
                        <div className={['mt-3 text-xs', selected ? 'text-background/70' : 'text-muted-foreground'].join(' ')}>
                          complexity +{option.complexityWeight}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Selected requirements</h2>
            {state.selectedOptions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No requirements selected yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.selectedOptions.map((option) => (
                  <li key={option.id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{option.category}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Derived config</h2>
            <DerivedList title="Skills" values={state.derivedConfig?.skills ?? []} />
            <DerivedList title="Agents" values={state.derivedConfig?.agents ?? []} />
            <DerivedList title="Validation gates" values={state.derivedConfig?.validationGates ?? []} />
            <DerivedList title="Artifacts" values={state.derivedConfig?.outputArtifactTypes ?? []} />
          </section>

          <section className="rounded-2xl border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Spec preview</h2>
            <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
              {state.preview}
            </pre>
          </section>
        </aside>
      </div>
    </main>
  );
}

function DerivedList({ title, values }: { title: string; values: readonly string[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      {values.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Select options to derive {title.toLowerCase()}.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs">
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
