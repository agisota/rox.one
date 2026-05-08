import * as React from 'react';

import { Button } from '../ui/button';
import {
  DEEP_MISSION_PRESETS,
  createDeepMissionEntryState,
  createDeepMissionEntryStateFromTruth,
  createDeepMissionLaunchPlan,
  createFakeDeepMissionDraftPersistenceAdapter,
  createFakeDeepMissionSchedulerAdapter,
  selectDeepMissionPreset,
  updateDeepMissionDraft,
  type DeepMissionEntryState,
  type DeepMissionEntryStateInput,
  type DeepMissionPreset,
  type DeepMissionPresetId,
} from './deep-missions-state';
import {
  createExperienceRuntimeStore,
  createInMemoryExperiencePersistenceAdapter,
  type ExperienceTruthState,
} from '@craft-agent/shared/workbench';
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
  truthState?: ExperienceTruthState;
  onLaunchMission?: (state: DeepMissionEntryState) => void;
  onSaveDraft?: (state: DeepMissionEntryState) => void;
}

export function DeepMissionsScreen({
  initialState,
  initialInput,
  truthState,
  onLaunchMission,
  onSaveDraft,
}: DeepMissionsScreenProps) {
  const [state, setState] = React.useState<DeepMissionEntryState>(() =>
    initialState ?? (truthState ? createDeepMissionEntryStateFromTruth(truthState) : createDeepMissionEntryState(initialInput)),
  );
  const [launchStatus, setLaunchStatus] = React.useState<string>('Ожидает запуска');

  const launchMission = React.useCallback(() => {
    if (!state.canLaunch) return;
    onLaunchMission?.(state);
    void createExperienceRuntimeStore({ adapter: createInMemoryExperiencePersistenceAdapter() })
      .then((runtimeStore) => createDeepMissionLaunchPlan(state, {
        now: '2026-04-30T00:00:00.000Z',
        actorId: 'user-one',
        ownerUserId: 'user-one',
        workspaceId: 'workspace-rox',
        teamId: 'team-alpha',
        draftPersistence: createFakeDeepMissionDraftPersistenceAdapter(),
        scheduler: createFakeDeepMissionSchedulerAdapter(),
        runtimeStore,
      }))
      .then((plan) => setLaunchStatus(`Запущено: ${plan.mission.id} / checkpoints ${plan.checkpoints.length}`))
      .catch((error) => setLaunchStatus(error instanceof Error ? error.message : 'Запуск миссии не удался'));
  }, [onLaunchMission, state]);

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
          <Button className="rounded-full" disabled={!state.canLaunch} onClick={launchMission}>
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
        <div className="mb-4 rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-sm text-cyan-100">
          Runtime launch: {launchStatus}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Режимы миссий">
          {['Deep Run', 'Deep Reasoning Lab', 'Agenda Carnage', 'Swarm Arena', 'Proactive Watchtower'].map((modeLabel) => (
            <span key={modeLabel} className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">
              {modeLabel}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ExperienceStatusChip status={state.status === 'ready' ? 'success' : state.status === 'empty' ? 'queued' : 'blocking'} label={`Состояние: ${localizeFormStatus(state.status)}`} />
          <ExperienceStatusChip status={state.canLaunch ? 'ready' : 'blocking'} label={state.canLaunch ? 'Можно запускать' : 'Нужны правки'} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FormField
            label="Название миссии"
            value={state.title}
            placeholder="Например: Проверка RC перед релизом"
            onChange={(value) => setState((current) => updateDeepMissionDraft(current, { title: value }))}
          />
          <SelectField
            label="Режим"
            value={state.mode}
            options={[
              ['deep_run', 'Глубокий прогон'],
              ['deep_reasoning_lab', 'Лаборатория рассуждения'],
              ['agenda_carnage', 'Agenda Carnage'],
              ['swarm_arena', 'Арена swarm'],
              ['round_table', 'Round Table'],
              ['autoresearch_loop', 'Autoresearch Loop'],
              ['proactive_watchtower', 'Proactive Watchtower'],
            ]}
            onChange={(value) => setState((current) => updateDeepMissionDraft(current, { mode: value as DeepMissionEntryState['mode'] }))}
          />
          <SelectField
            label="Слой"
            value={state.experienceLayer}
            options={[
              ['command', 'Командный центр'],
              ['game', 'Игровой слой'],
              ['arena', 'Арена'],
            ]}
            onChange={(value) => setState((current) => updateDeepMissionDraft(current, { experienceLayer: value as DeepMissionEntryState['experienceLayer'] }))}
          />
          <NumberField label="Длительность, часы" value={state.durationHours} min={1} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { durationHours: value }))} />
          <NumberField label="Частота чекпоинтов, часы" value={state.checkpointCadenceHours} min={1} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { checkpointCadenceHours: value }))} />
          <NumberField label="Бюджетный лимит" value={state.budgetCapCredits} min={0} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { budgetCapCredits: value }))} />
          <NumberField label="Token cap" value={state.tokenCap} min={0} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { tokenCap: value }))} />
          <NumberField label="Storage cap" value={state.storageCapBytes} min={0} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { storageCapBytes: value }))} />
          <NumberField label="Количество агентов" value={state.selectedAgentCount} min={1} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { selectedAgentCount: value }))} />
          <NumberField label="Целевой VDI" value={state.vdiTarget} min={0} max={100} onChange={(value) => setState((current) => updateDeepMissionDraft(current, { vdiTarget: value }))} />
        </div>
        <TextAreaField
          label="Цель миссии"
          value={state.objective}
          placeholder="Что должно быть доказано, собрано или исправлено"
          onChange={(value) => setState((current) => updateDeepMissionDraft(current, { objective: value }))}
        />
        <TextAreaField
          label="Исходный запрос"
          value={state.rawInput}
          placeholder="Вставьте исходный prompt, задачу или сырой контекст"
          onChange={(value) => setState((current) => updateDeepMissionDraft(current, { rawInput: value }))}
        />
      </ExperiencePanel>
    </ExperienceShell>
  );
}

function FormField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input
        className="mt-2 w-full rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium outline-none transition focus:border-cyan-300/60"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input
        className="mt-2 w-full rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium outline-none transition focus:border-cyan-300/60"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <select
        className="mt-2 w-full rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium outline-none transition focus:border-cyan-300/60"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 block rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <textarea
        className="mt-2 min-h-28 w-full resize-y rounded-[12px] border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 outline-none transition focus:border-cyan-300/60"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
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
    case 'Token cap is required before launch.':
      return 'Перед запуском нужен token cap.';
    case 'Storage cap is required before launch.':
      return 'Перед запуском нужен storage cap.';
    case 'At least one agent is required before launch.':
      return 'Нужен хотя бы один агент.';
    default:
      return error;
  }
}

function localizeFormStatus(status: string): string {
  if (status === 'empty') return 'пусто';
  if (status === 'invalid') return 'нужны правки';
  if (status === 'ready') return 'готово';
  if (status === 'launching') return 'запуск';
  if (status === 'launched') return 'запущено';
  if (status === 'blocked') return 'заблокировано';
  if (status === 'failed') return 'ошибка';
  return status;
}
