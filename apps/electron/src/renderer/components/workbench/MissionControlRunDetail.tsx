import * as React from 'react';

import { Button } from '../ui/button';
import {
  approveMissionBranch,
  completeMissionCheckpointFromControlAction,
  createMissionControlState,
  createMissionControlStateFromTruth,
  finalizeMissionFromControlAction,
  transitionMissionCheckpoint,
  type MissionControlState,
} from './mission-control-state';
import type { ExperienceRuntimeStore, ExperienceTruthState } from '@rox-one/shared/workbench';
import {
  ExperienceCard,
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceShell,
  ExperienceStatusChip,
  getStatusLabel,
  getStatusTone,
} from './experience-ui';

export interface MissionControlRunDetailProps {
  initialState?: MissionControlState;
  truthState?: ExperienceTruthState;
  runtimeStore?: ExperienceRuntimeStore;
  now?: () => string;
}

export function MissionControlRunDetail({ initialState, truthState, runtimeStore, now }: MissionControlRunDetailProps) {
  const [state, setState] = React.useState<MissionControlState>(() =>
    initialState ?? (truthState ? createMissionControlStateFromTruth(truthState) : createMissionControlState()),
  );
  const [lastAction, setLastAction] = React.useState<string>('Ожидает checkpoint action');
  const completeCheckpoint = React.useCallback((checkpointId: string) => {
    if (!runtimeStore) {
      setState((current) => transitionMissionCheckpoint(current, checkpointId, 'completed'));
      setLastAction(`Checkpoint completed locally: ${checkpointId}`);
      return;
    }

    void completeMissionCheckpointFromControlAction(state, {
      runtimeStore,
      checkpointId,
      now: now?.() ?? new Date().toISOString(),
    }).then((nextState) => {
      setState(nextState);
      setLastAction(`Runtime checkpoint completed: ${checkpointId}`);
    });
  }, [now, runtimeStore, state]);
  const finalizeMission = React.useCallback(() => {
    if (!state.canFinalize) {
      setLastAction('Mission finalization blocked by evidence gate');
      return;
    }

    if (!runtimeStore) {
      setLastAction('Mission finalize ready locally');
      return;
    }

    void finalizeMissionFromControlAction(state, {
      runtimeStore,
      now: now?.() ?? new Date().toISOString(),
    }).then((nextState) => {
      setState(nextState);
      setLastAction(nextState.mission.status === 'completed' ? 'Mission finalized through runtime' : 'Mission finalization blocked by evidence gate');
    });
  }, [now, runtimeStore, state]);
  const approveBranch = React.useCallback((approvalId: string) => {
    setState((current) => approveMissionBranch(current, approvalId));
    setLastAction(`Approval granted locally: ${approvalId}`);
  }, []);

  return (
    <ExperienceShell
      screen="mission-control"
      tone="arena"
      eyebrow="Центр миссий"
      title="Центр миссий"
      description={`${state.mission.title}: ${state.mission.objective}`}
      actions={(
        <div className="space-y-3 rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Финальный статус</div>
          <div className="mt-2">
            <ExperienceStatusChip status={state.canFinalize ? 'success' : 'blocking'} label={state.canFinalize ? 'Готово' : 'Заблокировано'} />
          </div>
          <Button className="rounded-full" disabled={!state.canFinalize} onClick={finalizeMission}>
            Финализировать миссию
          </Button>
        </div>
      )}
      aside={(
        <>
          <ExperiencePanel title="Валидационные гейты" subtitle="Финальный результат не проходит, пока есть blocking fail.">
            {state.gateResults.map((gate) => (
              <ExperienceMetricRow
                key={gate.gateId}
                label={gate.gateId}
                value={<ExperienceStatusChip status={getStatusTone(gate.status, gate.blocking)} label={`${getStatusLabel(gate.status)}${gate.blocking ? ' / блокер' : ''}`} />}
              />
            ))}
          </ExperiencePanel>

          <ExperiencePanel title="Согласования" subtitle="Дорогие ветки требуют ручного допуска.">
            {state.approvals.map((approval) => (
              <ExperienceCard key={approval.id} title={approval.title} meta={getStatusLabel(approval.status)}>
                <p>{localizeApprovalDescription(approval.description)}</p>
                {approval.status === 'pending' && (
                  <Button
                    className="mt-4 rounded-full"
                    variant="outline"
                    onClick={() => approveBranch(approval.id)}
                  >
                    Одобрить ветку
                  </Button>
                )}
              </ExperienceCard>
            ))}
          </ExperiencePanel>

          <ExperiencePanel title="Промежуточные артефакты">
            {state.artifacts.map((artifact) => (
              <ExperienceMetricRow
                key={artifact.id}
                label={localizeArtifactTitle(artifact.title)}
                value={`${artifact.checkpointId} / ${getStatusLabel(artifact.validationState)}`}
              />
            ))}
          </ExperiencePanel>

          <ExperiencePanel title="Аудит и биллинг">
            {state.auditEvents.map((event) => (
              <ExperienceMetricRow key={event.id} label={localizeAuditSummary(event.summary)} value={event.createdAt} />
            ))}
            {state.billingTrace.map((item) => (
              <ExperienceMetricRow key={item.id} label={localizeBillingLabel(item.label)} value={`${item.credits} credits / ${item.source}`} />
            ))}
          </ExperiencePanel>

          <ExperiencePanel title="Причины блокировки">
            {state.blockingReasons.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Блокеров нет.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {state.blockingReasons.map((reason) => (
                  <li key={reason} className="rounded-[16px] border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                    {localizeBlockingReason(reason)}
                  </li>
                ))}
              </ul>
            )}
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title="Таймлайн прогона" subtitle="Чекпоинты дают промежуточный результат и дельту VDI, но не завершают миссию без доказательств.">
        <div className="mb-4 rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-sm text-cyan-100">
          Runtime action: {lastAction}
        </div>
        <ol className="mt-4 space-y-3">
            {state.checkpoints.map((checkpoint) => (
              <li key={checkpoint.id}>
                <ExperienceCard title={localizeCheckpointTitle(checkpoint.title)} meta={`${checkpoint.id} / дельта VDI ${checkpoint.vdiDelta}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <ExperienceStatusChip status={getStatusTone(checkpoint.status)} label={getStatusLabel(checkpoint.status)} />
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => completeCheckpoint(checkpoint.id)}
                  >
                    Отметить готовым
                  </Button>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{localizeCheckpointSummary(checkpoint.summary)}</div>
                </ExperienceCard>
              </li>
            ))}
          </ol>
      </ExperiencePanel>

      <ExperiencePanel className="mt-4" title="Лента swarm" subtitle="Дедуплицированные сигналы от агентов, привязанные к чекпоинтам.">
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {state.feedItems.map((item) => (
            <ExperienceCard key={item.id} title={item.source} meta={`${item.checkpointId} / ${localizeSeverity(item.severity)}`} tone={item.severity === 'high' || item.severity === 'critical' ? 'danger' : 'warning'}>
              {localizeFeedSummary(item.summary)}
            </ExperienceCard>
          ))}
        </div>
      </ExperiencePanel>
    </ExperienceShell>
  );
}

function localizeCheckpointTitle(title: string): string {
  if (title === 'Mission brief') return 'Бриф миссии';
  if (title === 'Final verification') return 'Финальная проверка';
  return title.replace('Checkpoint', 'Чекпоинт');
}

function localizeCheckpointSummary(summary: string): string {
  return `Сводка чекпоинта: ${localizeCheckpointTitle(summary.replace(' summary', ''))}`;
}

function localizeApprovalDescription(description: string): string {
  if (description.includes('Requires explicit approval')) {
    return 'Требует явного согласования перед расходом дополнительного бюджета.';
  }
  return description;
}

function localizeArtifactTitle(title: string): string {
  if (title === '6h contradiction map') return '6ч карта противоречий';
  if (title === '12h evidence memo') return '12ч мемо доказательств';
  return title;
}

function localizeAuditSummary(summary: string): string {
  if (summary.includes('Mission started')) return 'Миссия запущена с 4 выбранными агентами.';
  if (summary.includes('moved to completed')) {
    const checkpointTitle = summary.replace(/^Checkpoint /, '').replace(' moved to completed.', '');
    return `Чекпоинт ${localizeCheckpointTitle(checkpointTitle)} переведен в готово.`;
  }
  return summary;
}

function localizeBillingLabel(label: string): string {
  if (label === 'Initial swarm pass') return 'Первичный проход swarm';
  return label;
}

function localizeBlockingReason(reason: string): string {
  if (reason.includes('Approval required for expensive branch')) {
    return reason.replace('Approval required for expensive branch:', 'Нужно согласование дорогой ветки:');
  }
  if (reason.includes('Critical validation gate failed')) {
    return reason.replace('Critical validation gate failed:', 'Критический валидационный гейт провален:');
  }
  return reason;
}

function localizeSeverity(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'критично';
    case 'high':
      return 'высокий риск';
    case 'medium':
      return 'средний риск';
    case 'low':
      return 'низкий риск';
    default:
      return 'инфо';
  }
}

function localizeFeedSummary(summary: string): string {
  if (summary.includes('unresolved dependency')) return 'План запуска зависит от ручного ревью и пока не закрыт доказательством.';
  if (summary.includes('source claims')) return 'Два источниковых утверждения требуют проверки свежести.';
  return summary;
}
