import * as React from 'react';

import { Button } from '../ui/button';
import {
  DEEP_MISSION_PRESETS,
  createDeepMissionEntryState,
  selectDeepMissionPreset,
  type DeepMissionEntryState,
  type DeepMissionEntryStateInput,
  type DeepMissionPreset,
  type DeepMissionPresetId,
} from './deep-missions-state';
import {
  ExperienceCard,
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceShell,
  ExperienceStatusChip,
} from './experience-ui';

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
    <ExperienceShell
      screen="deep-missions"
      tone="command"
      eyebrow="Слой опыта"
      title="Долгие миссии"
      description="Настройте 6/24/72-часовой прогон с бюджетом, чекпоинтами, лимитами агентов и целевым индексом проверенного результата перед запуском."
      actions={(
        <>
          <Button className="rounded-full border-white/10" variant="outline" onClick={() => onSaveDraft?.(state)}>
            Сохранить черновик
          </Button>
          <Button className="rounded-full" disabled={!state.canLaunch} onClick={() => state.canLaunch && onLaunchMission?.(state)}>
            Запустить миссию
          </Button>
        </>
      )}
      aside={(
        <>
          <ExperiencePanel title="Емкость и лимиты" subtitle="Платные возможности расширяют только емкость, не качество.">
            <ExperienceMetricRow label="Бюджет" value={`${state.budgetCapCredits} credits`} />
            <ExperienceMetricRow label="Token cap" value={state.tokenCap.toLocaleString('ru-RU')} />
            <ExperienceMetricRow label="Storage cap" value={`${state.storageCapBytes} bytes`} />
            <ExperienceMetricRow label="Выбранные агенты" value={`${state.selectedAgentCount}`} />
          </ExperiencePanel>

          <ExperiencePanel title="Чекпоинты" subtitle="Промежуточный результат каждые несколько часов.">
            <ol className="mt-3 space-y-2">
              {state.checkpointPreview.map((checkpoint) => (
                <li key={`${checkpoint.ordinal}-${checkpoint.hour}`} className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{localizeCheckpointTitle(checkpoint.title)}</div>
                    <ExperienceStatusChip status={checkpoint.hour === 0 ? 'ready' : checkpoint.hour === state.durationHours ? 'blocking' : 'queued'} label={`${checkpoint.hour}ч`} />
                  </div>
                </li>
              ))}
            </ol>
          </ExperiencePanel>

          <ExperiencePanel title="Готовность запуска">
            {state.validationErrors.length === 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <ExperienceStatusChip status="success" label="Готово" />
                <p className="text-sm text-muted-foreground">Черновик готов к handoff в fake scheduler.</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.validationErrors.map((error) => (
                  <li key={error} className="rounded-[16px] border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                    {localizeValidationError(error)}
                  </li>
                ))}
              </ul>
            )}
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title="Сценарии запуска" subtitle="Выберите глубину, частоту чекпоинтов и масштаб агентного состава.">
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {DEEP_MISSION_PRESETS.map((preset) => {
            const selected = preset.id === state.presetId;
            return (
              <ExperienceCard
                key={preset.id}
                interactive
                selected={selected}
                tone={presetTone(preset)}
                title={preset.label}
                meta={`${preset.durationHours}ч / каждые ${preset.checkpointCadenceHours}ч / ${preset.recommendedAgentCount} агентов`}
                onClick={() => setState((current) => selectDeepMissionPreset(current, preset.id as DeepMissionPresetId))}
              >
                {localizePresetDescription(preset.description)}
              </ExperienceCard>
            );
          })}
        </div>
      </ExperiencePanel>

      <ExperiencePanel className="mt-4" title="Бриф миссии" subtitle="То, что увидит планировщик перед стартом длительного прогона.">
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Режимы миссий">
          {['Deep Run', 'Deep Reasoning Lab', 'Agenda Carnage', 'Swarm Arena', 'Proactive Watchtower'].map((modeLabel) => (
            <span key={modeLabel} className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">
              {modeLabel}
            </span>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Название" value={state.title || 'Без названия'} />
          <ReadOnlyField label="Режим" value={formatMode(state.mode)} />
          <ReadOnlyField label="Слой" value={formatLayer(state.experienceLayer)} />
          <ReadOnlyField label="Целевой VDI" value={`${state.vdiTarget}`} />
        </div>
        <ReadOnlyBlock label="Цель" value={state.objective || 'Цель пока не задана.'} />
        <ReadOnlyBlock label="Исходный запрос" value={state.rawInput || 'Исходный запрос пока не передан.'} />
      </ExperiencePanel>
    </ExperienceShell>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function ReadOnlyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{value}</p>
    </div>
  );
}

function presetTone(preset: DeepMissionPreset) {
  if (preset.id === 'sprint_6h') return 'success' as const;
  if (preset.id === 'watchtower_72h') return 'arena' as const;
  return 'command' as const;
}

function localizePresetDescription(description: string): string {
  if (description.includes('focused short run')) return 'Короткий интенсивный прогон для ранних противоречий и блокеров.';
  if (description.includes('default deep mission')) return 'Основной 24-часовой режим с 6-часовыми чекпоинтами и финальной проверкой.';
  if (description.includes('longer proactive loop')) return 'Длинный watchtower-цикл для drift, рисков и периодического синтеза.';
  return description;
}

function localizeCheckpointTitle(title: string): string {
  if (title === 'Mission brief') return 'Бриф миссии';
  if (title === 'Final verification') return 'Финальная проверка';
  return title.replace('Checkpoint', 'Чекпоинт');
}

function localizeValidationError(error: string): string {
  switch (error) {
    case 'Raw mission input is required.':
      return 'Нужен исходный запрос миссии.';
    case 'Mission title is required.':
      return 'Нужно название миссии.';
    case 'Mission objective is required.':
      return 'Нужна цель миссии.';
    case 'Budget cap is required before launch.':
      return 'Перед запуском нужен бюджетный лимит.';
    default:
      return error;
  }
}

function formatMode(mode: string): string {
  if (mode === 'deep_run') return 'Глубокий прогон';
  if (mode === 'swarm_arena') return 'Арена swarm';
  return mode
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatLayer(layer: string): string {
  if (layer === 'command') return 'Командный центр';
  if (layer === 'game') return 'Игровой слой';
  if (layer === 'arena') return 'Арена';
  return layer;
}
