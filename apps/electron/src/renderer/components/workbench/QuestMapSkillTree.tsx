import * as React from 'react';

import type { ExperienceLayer } from '@rox-agent/shared/workbench';

import {
  createQuestMapState,
  getQuestPresentation,
  groupQuestsByLane,
  type QuestMapState,
} from './quest-map-state';

export interface QuestMapSkillTreeProps {
  initialState?: QuestMapState;
  layer?: ExperienceLayer;
}

export function QuestMapSkillTree({ initialState, layer = 'command' }: QuestMapSkillTreeProps) {
  const [state] = React.useState<QuestMapState>(() => initialState ?? createQuestMapState());
  const presentation = getQuestPresentation(layer);
  const laneGroups = groupQuestsByLane(state.quests);

  return (
    <main className="flex h-full min-h-0 flex-col bg-background text-foreground" aria-label={presentation.title}>
      <header className="border-b border-border px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Experience Layer</p>
        <h1 className="mt-2 text-2xl font-semibold">{presentation.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {presentation.laneLabel} over the same quest truth. Presentation can change language, but evidence, progress, rewards, and unlocks stay fixed.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section className="min-h-0 overflow-y-auto rounded-2xl border border-border bg-muted/10 p-4">
          <h2 className="text-sm font-semibold">{presentation.laneLabel}</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {laneGroups.map((group) => (
              <section key={group.lane} className="rounded-xl border border-border bg-background p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.lane}</div>
                <div className="mt-3 space-y-3">
                  {group.quests.map((quest) => {
                    const progress = state.progressByQuestId[quest.id];
                    return (
                      <article key={quest.id} className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="text-sm font-semibold">{quest.title}</div>
                        <p className="mt-2 text-sm text-muted-foreground">{quest.description}</p>
                        <div className="mt-3 text-xs text-muted-foreground">
                          {presentation.progressLabel}: {progress?.status ?? 'missing'} / {progress?.percent ?? 0}%
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>

        <aside className="min-h-0 space-y-4 overflow-y-auto">
          <Panel title="Unlocked Rewards">
            {state.unlockedRewardIds.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No rewards unlocked yet.</p>
            ) : (
              state.unlockedRewardIds.map((rewardId) => <MetricRow key={rewardId} label={rewardId} value="unlocked" />)
            )}
          </Panel>

          <Panel title="Integrity Rules">
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Completed quests require artifact or gate evidence.</li>
              <li>Locked quests cannot be manually completed.</li>
              <li>Command/Game/Arena copy cannot mutate quest truth.</li>
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
