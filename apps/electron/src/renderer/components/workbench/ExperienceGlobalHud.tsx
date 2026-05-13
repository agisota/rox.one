import * as React from 'react';

import {
  EXPERIENCE_QUEST_GRAPH,
  type ExperienceLayer,
  type ExperienceRuntimeState,
} from '@rox-one/shared/workbench';

import { cn } from '@/lib/utils';
import { ExperienceFeedbackStrip } from './experience-ui';

export interface ExperienceGlobalHudState {
  layer: ExperienceLayer;
  verifiedDeliverableIndex: number;
  executionReadiness: number;
  qualityScore: number;
  activeMissionTitle: string;
  activeMissionStatus: string;
  nextQuestTitle: string;
  blockers: string[];
  xp: number;
  level: number;
  latestNotification: string;
}

export function createExperienceGlobalHudState(
  runtimeState: ExperienceRuntimeState,
  layer: ExperienceLayer = 'command',
): ExperienceGlobalHudState {
  const latestSnapshot = runtimeState.metricSnapshots.at(-1);
  const activeMission = runtimeState.missions.find((mission) => mission.id === runtimeState.activeMissionId) ?? runtimeState.missions.at(-1);
  const completedQuestIds = new Set(
    runtimeState.questProgress
      .filter((progress) => progress.status === 'completed')
      .map((progress) => progress.questId),
  );
  const nextQuest = EXPERIENCE_QUEST_GRAPH.find((quest) => !completedQuestIds.has(quest.id));
  const blockers = runtimeState.gateResults
    .filter((gate) => gate.blocking || gate.status === 'fail')
    .map((gate) => gate.gateId);
  const xp = runtimeState.ledger
    .filter((entry) => entry.currency === 'xp')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const priorityNotification = [...runtimeState.notifications]
    .reverse()
    .find((notification) => notification.kind === 'error' || notification.kind === 'warning')
    ?? runtimeState.notifications.at(-1);

  return {
    layer,
    verifiedDeliverableIndex: latestSnapshot?.verifiedDeliverableIndex ?? 0,
    executionReadiness: latestSnapshot?.executionReadiness ?? 0,
    qualityScore: latestSnapshot?.qualityScore ?? 0,
    activeMissionTitle: activeMission?.title ?? 'Нет активной миссии',
    activeMissionStatus: activeMission?.status ?? 'idle',
    nextQuestTitle: nextQuest?.title ?? 'Все квесты закрыты',
    blockers,
    xp,
    level: Math.max(1, Math.floor(xp / 100) + 1),
    latestNotification: priorityNotification?.message ?? 'Нет новых событий',
  };
}

export function ExperienceGlobalHud({
  runtimeState,
  layer = 'command',
  className,
}: {
  runtimeState: ExperienceRuntimeState;
  layer?: ExperienceLayer;
  className?: string;
}) {
  const state = createExperienceGlobalHudState(runtimeState, layer);
  const blockerLabel = state.blockers.length > 0 ? state.blockers.join(', ') : 'нет блокеров';
  const latestArtifact = runtimeState.artifacts.at(-1);
  const feedbackItems = [
    { id: 'hud-vdi', kind: 'vdi' as const, label: `VDI ${state.verifiedDeliverableIndex}`, detail: 'runtime truth' },
    { id: 'hud-xp', kind: 'xp' as const, label: `${state.xp} XP`, detail: `уровень ${state.level}` },
    ...(state.blockers.length > 0
      ? [{ id: 'hud-blocker', kind: 'gate_failed' as const, label: 'Gate failed', detail: blockerLabel }]
      : latestArtifact
        ? [{
            id: 'hud-artifact',
            kind: 'artifact_accepted' as const,
            label: 'Artifact accepted',
            detail: latestArtifact.title,
          }]
        : []),
  ];

  return (
    <section
      aria-label="ROX Experience HUD"
      data-experience-hud={layer}
      className={cn(
        'max-w-full border-b border-white/[0.07] bg-[#08090d] px-3 py-2 text-foreground',
        className,
      )}
    >
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 text-[11px] leading-5">
        <span className="min-w-0 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-1 font-semibold text-cyan-100">
          ROX Experience
        </span>
        <HudMetric label="VDI" value={`${state.verifiedDeliverableIndex}`} />
        <HudMetric label="Готовность" value={`${state.executionReadiness}`} />
        <HudMetric label="Качество" value={`${state.qualityScore}`} />
        <HudMetric label="Миссия" value={`${state.activeMissionTitle} / ${state.activeMissionStatus}`} wide />
        <HudMetric label="Следующий квест" value={state.nextQuestTitle} wide />
        <HudMetric label="Блокеры" value={blockerLabel} tone={state.blockers.length > 0 ? 'danger' : 'neutral'} wide />
        <HudMetric label="Прогресс" value={`${state.xp} XP / уровень ${state.level}`} />
        <HudMetric label="Событие" value={state.latestNotification} wide />
      </div>
      <ExperienceFeedbackStrip
        tone={layer === 'arena' ? 'arena' : layer === 'game' ? 'game' : 'command'}
        className="mt-2"
        items={feedbackItems}
      />
    </section>
  );
}

function HudMetric({
  label,
  value,
  tone = 'neutral',
  wide = false,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'danger';
  wide?: boolean;
}) {
  return (
    <span
      className={cn(
        'min-w-0 max-w-full rounded-full border px-2.5 py-1',
        wide ? 'max-w-[320px] truncate' : 'whitespace-nowrap',
        tone === 'danger'
          ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
          : 'border-white/10 bg-white/[0.035] text-muted-foreground',
      )}
    >
      <span className="font-semibold text-foreground">{label}:</span> {value}
    </span>
  );
}
