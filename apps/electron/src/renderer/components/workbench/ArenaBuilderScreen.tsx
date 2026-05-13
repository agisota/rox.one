import * as React from 'react';

import { Button } from '../ui/button';
import {
  createArenaBuilderState,
  createArenaBuilderStateFromTruth,
  createArenaDraftRun,
  toggleArenaAgentSelection,
  type ArenaAgentCollectionItem,
  type ArenaBuilderState,
  type ArenaBuilderStateInput,
  type ArenaDraftRun,
} from './arena-builder-state';
import type { ExperienceTruthState } from '@rox-one/shared/workbench';
import {
  ExperienceCard,
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceProgressBar,
  ExperienceShell,
  ExperienceStatusChip,
} from './experience-ui';

export interface ArenaBuilderScreenProps {
  initialState?: ArenaBuilderState;
  initialInput?: ArenaBuilderStateInput;
  truthState?: ExperienceTruthState;
  onCreateDraftRun?: (draftRun: ArenaDraftRun) => void;
}

export function ArenaBuilderScreen({ initialState, initialInput, truthState, onCreateDraftRun }: ArenaBuilderScreenProps) {
  const [state, setState] = React.useState<ArenaBuilderState>(() =>
    initialState ?? (truthState ? createArenaBuilderStateFromTruth(truthState, initialInput) : createArenaBuilderState(initialInput)),
  );
  const selectedAgents = state.selectedAgentPackageIds
    .map((id) => state.roster.find((agent) => agent.package.id === id))
    .filter((agent): agent is ArenaAgentCollectionItem => Boolean(agent));
  const [draftRun, setDraftRun] = React.useState<ArenaDraftRun | undefined>();
  const createDraft = React.useCallback(() => {
    if (!state.canCreateDraft) return;
    const nextDraft = createArenaDraftRun(state);
    setDraftRun(nextDraft);
    onCreateDraftRun?.(nextDraft);
  }, [onCreateDraftRun, state]);

  return (
    <ExperienceShell
      screen="arena-builder"
      tone="arena"
      eyebrow="Режим арены"
      title="Арена агентов"
      description="Соберите swarm из проверенных пакетов агентов. Игровая подача может быть жестче, но проверки доверия, валидационные гейты и бюджет остаются общими правилами."
      actions={(
        <Button
          className="rounded-full"
          disabled={!state.canCreateDraft}
          onClick={createDraft}
        >
          Создать прогон
        </Button>
      )}
      aside={(
        <>
          <ExperiencePanel title="Выбранные агенты" subtitle="Активная команда для текущего черновика swarm.">
            {selectedAgents.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Агенты пока не выбраны.</p>
            ) : (
              <ol className="mt-3 space-y-2">
                {selectedAgents.map((agent) => (
                  <li key={agent.package.id} className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{agent.package.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {localizeRole(agent.roleTag)} / доверие {agent.package.trustScore} / {agent.baseCostCredits} кредитов
                        </div>
                      </div>
                      <ExperienceStatusChip status="running" label={`уровень ${agent.level}`} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </ExperiencePanel>

          <ExperiencePanel title="Оценка бюджета" subtitle="Емкость влияет на слоты, не на VDI.">
            <ExperienceMetricRow label="Кредиты" value={`${state.runEstimate.budgetEstimateCredits}`} />
            <ExperienceMetricRow label="Ожидаемые вклады" value={`${state.runEstimate.estimatedContributionCount}`} />
            <ExperienceMetricRow label="Минимум доверия" value={`${state.runEstimate.trustFloor}`} />
            <ExperienceMetricRow label="Обязательные гейты" value={state.runEstimate.validationGateIds.join(', ')} />
          </ExperiencePanel>

          <ExperiencePanel title="Черновик swarm" subtitle="Создается из текущего selector state, без скрытых выбранных агентов.">
            {draftRun ? (
              <>
                <ExperienceMetricRow label="Режим" value={draftRun.mode} />
                <ExperienceMetricRow label="Агенты" value={draftRun.selectedAgentPackageIds.join(', ')} />
                <ExperienceMetricRow label="Бюджет" value={`${draftRun.budgetEstimateCredits} credits`} />
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Нажмите «Создать прогон», чтобы зафиксировать draft из выбранной команды.</p>
            )}
          </ExperiencePanel>

          <ExperiencePanel title="Предупреждения выбора">
            {state.selectionWarnings.length === 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <ExperienceStatusChip status="success" label="Готово" />
                <p className="text-sm text-muted-foreground">Лимиты и unlock-правила соблюдены.</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.selectionWarnings.map((warning) => (
                  <li key={warning} className="rounded-[16px] border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {localizeArenaWarning(warning)}
                  </li>
                ))}
              </ul>
            )}
          </ExperiencePanel>
        </>
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Коллекция агентов</h2>
          <p className="mt-1 text-sm text-muted-foreground">Выбирайте разблокированных агентов для текущего черновика swarm.</p>
        </div>
          <ExperienceStatusChip status={state.runEstimate.swarmSlotsUsed > 0 ? 'running' : 'queued'} label={`${state.runEstimate.swarmSlotsUsed} / ${state.runEstimate.swarmSlotLimit} слота`} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {state.roster.map((agent) => {
          const selected = state.selectedAgentPackageIds.includes(agent.package.id);
          return (
            <ExperienceCard
              key={agent.package.id}
              interactive
              selected={selected}
              disabled={!agent.unlocked}
              tone={agent.package.rarity === 'legendary' ? 'danger' : agent.package.rarity === 'epic' ? 'game' : 'neutral'}
              title={agent.package.name}
              meta={`${localizeRole(agent.roleTag)} / ${localizeRarity(agent.package.rarity)} / уровень ${agent.level}`}
              onClick={() => setState((current) => toggleArenaAgentSelection(current, agent.package.id))}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{localizeAgentDescription(agent.package.description)}</span>
                <ExperienceStatusChip status={agent.unlocked ? 'success' : 'locked'} label={agent.unlocked ? 'Разблокировано' : 'Заблокировано'} />
              </div>
              <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Доверие {agent.package.trustScore}</span>
                <span>Мастерство {agent.masteryPercent}%</span>
                <span>{agent.baseCostCredits} кредитов</span>
              </div>
              <ExperienceProgressBar value={agent.masteryPercent} label="Прокачка навыка" />
              {!agent.unlocked && (
                <div className="mt-3 text-xs text-muted-foreground">
                  Разблокировка: {localizeUnlockCriteria(agent.unlockCriteria)}
                </div>
              )}
            </ExperienceCard>
          );
        })}
      </div>
    </ExperienceShell>
  );
}

function localizeRole(role: string): string {
  switch (role) {
    case 'Architecture':
      return 'Архитектура';
    case 'Critique':
      return 'Критика';
    case 'Research':
      return 'Исследование';
    case 'Verification':
      return 'Проверка';
    case 'Adversarial':
      return 'Red Team';
    default:
      return role;
  }
}

function localizeRarity(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return 'легендарный';
    case 'epic':
      return 'эпический';
    case 'rare':
      return 'редкий';
    default:
      return rarity;
  }
}

function localizeArenaWarning(warning: string): string {
  if (warning.includes('locked and cannot be selected')) return warning.replace(' is locked and cannot be selected.', ' заблокирован и не может быть выбран.');
  if (warning.includes('Swarm selection is capped')) return warning.replace('Swarm selection is capped at', 'Выбор swarm ограничен').replace('slots by current entitlement.', 'слотами текущего доступа.');
  return warning;
}

function localizeAgentDescription(description: string): string {
  if (description.includes('Maps system boundaries')) return 'Находит границы системы, зависимости и риски реализации.';
  if (description.includes('Attacks assumptions')) return 'Атакует допущения, противоречия и недостающие доказательства.';
  if (description.includes('Finds evidence')) return 'Ищет доказательства, свежесть источников и альтернативные позиции.';
  if (description.includes('Turns findings')) return 'Превращает находки в блокирующие гейты и регрессионные проверки.';
  if (description.includes('Runs high-risk')) return 'Запускает жесткую adversarial-критику и поиск exploit-path.';
  return description;
}

function localizeUnlockCriteria(criteria: string[]): string {
  return criteria
    .map((criterion) => criterion
      .replace('Reach VDI 85 on 3 missions', 'Достигнуть VDI 85 в 3 миссиях')
      .replace('Enable private team registry trust checks', 'Включить проверки доверия приватного командного реестра'))
    .join(' + ');
}
