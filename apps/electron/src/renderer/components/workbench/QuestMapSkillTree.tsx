import * as React from 'react';

import type { ExperienceLayer } from '@rox-agent/shared/workbench';
import type { ExperienceTruthState } from '@rox-agent/shared/workbench';

import { Button } from '../ui/button';
import {
  completeQuestAndEvaluateUnlocks,
  createQuestMapState,
  createQuestMapStateFromTruth,
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
  truthState?: ExperienceTruthState;
}

export function QuestMapSkillTree({ initialState, layer = 'command', truthState }: QuestMapSkillTreeProps) {
  const [state, setState] = React.useState<QuestMapState>(() =>
    initialState ?? (truthState ? createQuestMapStateFromTruth(truthState) : createQuestMapState()),
  );
  const [lastAction, setLastAction] = React.useState<string>('Ожидает действия');
  const presentation = getQuestPresentation(layer);
  const laneGroups = groupQuestsByLane(state.quests);

  const completeQuest = React.useCallback((questId: string) => {
    try {
      setState((current) => completeQuestAndEvaluateUnlocks(current, questId, [`artifact:${questId}:interactive-evidence`]));
      setLastAction(`Квест завершен: ${questId}`);
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : 'Квест не удалось завершить');
    }
  }, []);

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
        <div className="mb-4 rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-sm text-cyan-100">
          Runtime action: {lastAction}
        </div>
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
                        <Button
                          className="mt-4 rounded-full"
                          variant="outline"
                          disabled={progress?.status === 'locked' || progress?.status === 'completed'}
                          onClick={() => completeQuest(quest.id)}
                        >
                          {progress?.status === 'completed' ? 'Квест закрыт' : 'Завершить с evidence'}
                        </Button>
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
  if (title === 'Frame raw prompt') return 'Оформить сырой prompt';
  if (title === 'Rewrite prompt') return 'Переписать prompt';
  if (title === 'Clarify assumptions') return 'Прояснить допущения';
  if (title === 'Build executable spec') return 'Собрать исполняемую спецификацию';
  if (title === 'Generate TDD plan') return 'Собрать TDD-план';
  if (title === 'Run Review Gate') return 'Пройти Review Gate';
  if (title === 'Launch first deep mission') return 'Запустить первую долгую миссию';
  if (title === 'Complete checkpoint with evidence') return 'Закрыть checkpoint с evidence';
  if (title === 'Resolve blocker') return 'Снять блокер';
  if (title === 'Final verified deliverable') return 'Финальный проверенный результат';
  if (title === 'Launch swarm arena') return 'Запустить swarm-арену';
  if (title === 'Install trusted agent package') return 'Установить доверенный пакет агента';
  if (title === 'Fork package into team registry') return 'Форкнуть пакет в реестр команды';
  if (title === 'Share verified session') return 'Поделиться проверенной сессией';
  return title;
}

function localizeQuestDescription(description: string): string {
  if (description.includes('raw request')) return 'Превратить сырой запрос в цель, ограничения и требования к evidence.';
  if (description.includes('Improve the prompt')) return 'Сделать prompt пригодным для спецификации и исполнения.';
  if (description.includes('open assumptions')) return 'Зафиксировать допущения перед планированием исполнения.';
  if (description.includes('Compile a spec')) return 'Собрать spec, готовый к агентному выполнению.';
  if (description.includes('red-green-verify')) return 'Создать TDD-план перед реализацией.';
  if (description.includes('review validation')) return 'Прогнать Review Gate и записать evidence.';
  if (description.includes('durable mission')) return 'Запустить миссию через runtime store.';
  if (description.includes('Complete a checkpoint')) return 'Закрыть checkpoint только после артефакта или gate evidence.';
  if (description.includes('blocking gate')) return 'Снять блокировку через последующее проверенное evidence.';
  if (description.includes('final artifact')) return 'Завершить миссию финальным артефактом и gate evidence.';
  if (description.includes('swarm mission draft')) return 'Создать swarm-черновик с выбранными доверенными агентами.';
  if (description.includes('contract and trust')) return 'Установить пакет только после contract и trust checks.';
  if (description.includes('team registry')) return 'Форкнуть доверенный пакет в реестр команды.';
  if (description.includes('redacted verified')) return 'Поделиться только redacted verified session bundle.';
  return description;
}
