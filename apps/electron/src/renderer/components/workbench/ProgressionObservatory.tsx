import * as React from 'react';

import { Button } from '../ui/button';
import {
  appendProgressLedgerEvent,
  createProgressionState,
  createProgressionStateFromTruth,
  projectLeaderboardRows,
  type ProgressionState,
  type ProgressionStateInput,
} from './progression-observatory-state';
import type { ExperienceTruthState } from '@craft-agent/shared/workbench';
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
  truthState?: ExperienceTruthState;
}

export function ProgressionObservatory({ initialState, initialInput, truthState }: ProgressionObservatoryProps) {
  const [state, setState] = React.useState<ProgressionState>(() =>
    initialState ?? (truthState ? createProgressionStateFromTruth(truthState, initialInput) : createProgressionState(initialInput)),
  );
  const visibleLeaderboardRows = projectLeaderboardRows(state);
  const awardEvidenceXp = React.useCallback(() => {
    setState((current) => appendProgressLedgerEvent(current, {
      id: `ledger-xp-interactive-${current.ledger.length + 1}`,
      userId: 'user-one',
      teamId: current.leaderboardPolicy.viewerTeamId ?? 'team-alpha',
      eventType: 'xp',
      amount: 25,
      currency: 'xp',
      reason: 'Interactive evidence checkpoint accepted',
      sourceArtifactId: 'artifact:interactive-checkpoint-evidence',
      createdAt: '2026-04-30T00:00:00.000Z',
    }));
  }, []);

  return (
    <ExperienceShell
      screen="progression"
      tone="game"
      eyebrow="Слой опыта"
      title="Обсерватория прогресса"
      description="Сквозная метрика продукта: VDI как North Star, а качество постановки и готовность к выполнению остаются доказательными подметриками."
      actions={(
        <Button className="rounded-full" onClick={awardEvidenceXp}>
          Записать XP evidence
        </Button>
      )}
      aside={(
        <>
          <ExperiencePanel title="Журнал экономики" subtitle="XP и кредиты записываются только от событий с доказательствами.">
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
              <li>XP и разблокировки требуют артефакт или доказательство валидационного гейта.</li>
              <li>Платная емкость может увеличить только слоты и длительность.</li>
              <li>Очки качества и VDI остаются доказательными метриками.</li>
            </ul>
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title="Индекс проверенного результата" subtitle="VDI показывает, дошла ли работа до принятого проверенного результата.">
        <div className="mt-4 rounded-[22px] border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
          <div className="text-5xl font-semibold leading-none">{state.latestSnapshot.verifiedDeliverableIndex}</div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Доказательства: {state.latestSnapshot.evidenceRefs.join(', ')}
          </p>
          <ExperienceProgressBar value={state.latestSnapshot.verifiedDeliverableIndex} label="Прогресс VDI" />
        </div>
      </ExperiencePanel>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ExperienceMetricCard label="Очки качества" value={`${state.latestSnapshot.qualityScore}`} tone="success" detail="Насколько хорошо поставлена задача." />
        <ExperienceMetricCard label="Готовность к выполнению" value={`${state.latestSnapshot.executionReadiness}`} tone="command" detail="Можно ли запускать агентов без лишних уточнений." />
        <ExperienceMetricCard label="Эффективность стоимости" value={`${state.latestSnapshot.costEfficiency}`} detail="Результат на единицу бюджета." />
        <ExperienceMetricCard label="Открытый риск" value={`${state.latestSnapshot.openRiskScore}`} tone="warning" detail="Незакрытые риски перед финальным pass." />
        <ExperienceMetricCard label="Шум" value={`${state.latestSnapshot.noiseScore}`} detail="Дубли, слабые сигналы и лишние ответы." />
        <ExperienceMetricCard label="Емкость swarm" value={`${state.capacity.swarmSlots} слота / ${state.capacity.maxMissionHours}ч`} tone="arena" detail="Емкость, не качество." />
      </div>
    </ExperienceShell>
  );
}

function localizeLedgerReason(reason: string): string {
  if (reason === 'Accepted verified mission artifact') return 'Принят проверенный артефакт миссии';
  if (reason === 'Initial swarm pass') return 'Первичный проход swarm';
  return reason;
}
