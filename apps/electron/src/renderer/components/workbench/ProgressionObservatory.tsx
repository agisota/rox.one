import * as React from 'react';

import {
  createProgressionState,
  projectLeaderboardRows,
  type ProgressionState,
  type ProgressionStateInput,
} from './progression-observatory-state';
import {
  ExperienceMetricCard,
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceProgressBar,
  ExperienceShell,
} from './experience-ui';

export interface ProgressionObservatoryProps {
  initialState?: ProgressionState;
  initialInput?: ProgressionStateInput;
}

export function ProgressionObservatory({ initialState, initialInput }: ProgressionObservatoryProps) {
  const [state] = React.useState<ProgressionState>(() => initialState ?? createProgressionState(initialInput));
  const visibleLeaderboardRows = projectLeaderboardRows(state);

  return (
    <ExperienceShell
      screen="progression"
      tone="game"
      eyebrow="Слой опыта"
      title="Обсерватория прогресса"
      description="Сквозная метрика продукта: VDI как North Star, а качество постановки и готовность к выполнению остаются доказательными подметриками."
      aside={(
        <>
          <ExperiencePanel title="Журнал экономики" subtitle="XP и credits записываются только от evidence-событий.">
            {state.ledger.map((entry) => (
              <ExperienceMetricRow key={entry.id} label={localizeLedgerReason(entry.reason)} value={`${entry.amount} ${entry.currency}`} />
            ))}
          </ExperiencePanel>

          <ExperiencePanel title="Лидеры">
            {visibleLeaderboardRows.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Лидерборды скрыты политикой приватности.</p>
            ) : (
              visibleLeaderboardRows.map((row) => (
                <ExperienceMetricRow key={row.id} label={row.displayName} value={`${row.score}`} />
              ))
            )}
          </ExperiencePanel>

          <ExperiencePanel title="Правила честности">
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>XP и unlocks требуют артефакт или validation gate evidence.</li>
              <li>Платная емкость может увеличить только слоты и длительность.</li>
              <li>Очки качества и VDI остаются доказательными метриками.</li>
            </ul>
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title="Индекс проверенного результата" subtitle="Verified Deliverable Index показывает, дошла ли работа до принятого проверенного результата.">
        <div className="mt-4 rounded-[22px] border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
          <div className="text-5xl font-semibold leading-none">{state.latestSnapshot.verifiedDeliverableIndex}</div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Evidence: {state.latestSnapshot.evidenceRefs.join(', ')}
          </p>
          <ExperienceProgressBar value={state.latestSnapshot.verifiedDeliverableIndex} label="VDI progress" />
        </div>
      </ExperiencePanel>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ExperienceMetricCard label="Очки качества" value={`${state.latestSnapshot.qualityScore}`} tone="success" detail="Насколько хорошо поставлена задача." />
        <ExperienceMetricCard label="Готовность к выполнению" value={`${state.latestSnapshot.executionReadiness}`} tone="command" detail="Можно ли запускать агентов без лишних уточнений." />
        <ExperienceMetricCard label="Эффективность стоимости" value={`${state.latestSnapshot.costEfficiency}`} detail="Результат на единицу бюджета." />
        <ExperienceMetricCard label="Открытый риск" value={`${state.latestSnapshot.openRiskScore}`} tone="warning" detail="Незакрытые риски перед финальным pass." />
        <ExperienceMetricCard label="Шум" value={`${state.latestSnapshot.noiseScore}`} detail="Дубли, слабые сигналы и лишние ответы." />
        <ExperienceMetricCard label="Емкость swarm" value={`${state.capacity.swarmSlots} слота / ${state.capacity.maxMissionHours}ч`} tone="arena" detail="Capacity, не качество." />
      </div>
    </ExperienceShell>
  );
}

function localizeLedgerReason(reason: string): string {
  if (reason === 'Accepted verified mission artifact') return 'Принят проверенный артефакт миссии';
  if (reason === 'Initial swarm pass') return 'Первичный swarm pass';
  return reason;
}
