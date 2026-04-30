import * as React from 'react';

import type { ExperienceLayer } from '@craft-agent/shared/workbench';

import {
  createQuestMapState,
  getQuestPresentation,
  groupQuestsByLane,
  type QuestMapState,
} from './quest-map-state';
import {
  ExperienceCard,
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceProgressBar,
  ExperienceShell,
  ExperienceStatusChip,
  getStatusLabel,
  getStatusTone,
} from './experience-ui';

export interface QuestMapSkillTreeProps {
  initialState?: QuestMapState;
  layer?: ExperienceLayer;
}

export function QuestMapSkillTree({ initialState, layer = 'command' }: QuestMapSkillTreeProps) {
  const [state] = React.useState<QuestMapState>(() => initialState ?? createQuestMapState());
  const presentation = getQuestPresentation(layer);
  const laneGroups = groupQuestsByLane(state.quests);

  return (
    <ExperienceShell
      screen="quest-map"
      tone={layer === 'arena' ? 'arena' : layer === 'game' ? 'game' : 'command'}
      eyebrow="Слой опыта"
      title={presentation.title}
      description={`${presentation.laneLabel} поверх единой quest truth: оформление может меняться, но evidence, прогресс, награды и unlocks остаются фиксированными.`}
      aside={(
        <>
          <ExperiencePanel title="Разблокированные награды">
            {state.unlockedRewardIds.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Награды пока не разблокированы.</p>
            ) : (
              state.unlockedRewardIds.map((rewardId) => (
                <ExperienceMetricRow key={rewardId} label={rewardId} value="Разблокировано" />
              ))
            )}
          </ExperiencePanel>

          <ExperiencePanel title="Правила честности">
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Завершенные квесты требуют артефакт или gate evidence.</li>
              <li>Заблокированные квесты нельзя завершить вручную.</li>
              <li>Command/Game/Arena copy не меняет quest truth.</li>
            </ul>
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title={presentation.laneLabel} subtitle="Квесты открываются только через доказанный прогресс, а не через ручную отметку.">
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {laneGroups.map((group) => (
              <section key={group.lane} className="rounded-[20px] border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{localizeQuestLane(group.lane)}</div>
                <div className="mt-3 space-y-3">
                  {group.quests.map((quest) => {
                    const progress = state.progressByQuestId[quest.id];
                    return (
                      <ExperienceCard
                        key={quest.id}
                        title={localizeQuestTitle(quest.title)}
                        meta={<ExperienceStatusChip status={getStatusTone(progress?.status ?? 'locked')} label={getStatusLabel(progress?.status ?? 'locked')} />}
                        tone={progress?.status === 'available' ? 'game' : 'neutral'}
                      >
                        <p>{localizeQuestDescription(quest.description)}</p>
                        <ExperienceProgressBar value={progress?.percent ?? 0} label={presentation.progressLabel} />
                      </ExperienceCard>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
      </ExperiencePanel>
    </ExperienceShell>
  );
}

function localizeQuestLane(lane: string): string {
  switch (lane) {
    case 'formulate':
      return 'Формулировка';
    case 'specify':
      return 'Спецификация';
    case 'execute':
      return 'Выполнение';
    case 'verify':
      return 'Проверка';
    case 'marketplace':
      return 'Маркетплейс';
    case 'team':
      return 'Команда';
    case 'arena':
      return 'Арена';
    default:
      return lane;
  }
}

function localizeQuestTitle(title: string): string {
  if (title === 'Frame the raw prompt') return 'Оформить сырой prompt';
  if (title === 'Build the executable spec') return 'Собрать исполняемую спецификацию';
  if (title === 'Launch a swarm arena') return 'Запустить swarm-арену';
  return title;
}

function localizeQuestDescription(description: string): string {
  if (description.includes('unclear idea')) return 'Превратить неясную идею в цель, ограничения и требования к evidence.';
  if (description.includes('build-ready spec')) return 'Выбрать требования и собрать spec, готовый к агентному выполнению.';
  if (description.includes('deduped swarm')) return 'Запустить deduped swarm и получить проверенный minority report.';
  return description;
}
