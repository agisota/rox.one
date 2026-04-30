import * as React from 'react';

import {
  createAgentForgeState,
  getPackageTrustScore,
  listVisibleAgentPackages,
  type AgentForgeState,
  type AgentForgeStateInput,
} from './agent-forge-state';

export interface AgentForgeTeamRegistryProps {
  initialState?: AgentForgeState;
  initialInput?: AgentForgeStateInput;
}

export function AgentForgeTeamRegistry({ initialState, initialInput }: AgentForgeTeamRegistryProps) {
  const [state] = React.useState<AgentForgeState>(() => initialState ?? createAgentForgeState(initialInput));
  const visiblePackages = listVisibleAgentPackages(state, { viewerTeamId: state.viewerTeamId });

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label="Agent Forge">
      <header className="border-b border-border px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Agent Forge</p>
        <h1 className="mt-2 text-2xl font-semibold">Team Registry</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Forge, review, install, and fork private/team packages before public marketplace distribution is allowed.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <h2 className="text-sm font-semibold">Private and Team Packages</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visiblePackages.map((pkg) => {
              const contract = state.contractsByPackageId[pkg.id];
              const warnings = state.promptInjectionWarningsByPackageId[pkg.id] ?? [];
              return (
                <article key={pkg.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="text-sm font-semibold">{pkg.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {pkg.visibility} / trust {getPackageTrustScore(state, pkg.id)}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{pkg.description}</p>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>Contract: {contract ? 'present' : 'missing'}</span>
                    <span>Warnings: {warnings.length}</span>
                    <span>Install</span>
                    <span>Fork</span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <Panel title="Forge Gauntlet">
            <MetricRow label="Contract" value="required" />
            <MetricRow label="Reviews" value="required" />
            <MetricRow label="Tests" value="required" />
            <MetricRow label="Prompt injection scan" value="blocks public publish" />
          </Panel>

          <Panel title="Registry Guardrails">
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Public marketplace is disabled until team/private registry checks pass.</li>
              <li>Packages without contracts cannot install.</li>
              <li>Team-private packages are hidden cross-tenant.</li>
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
