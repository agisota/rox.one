import * as React from 'react'
import {
  ClipboardCheck,
  FileSearch,
  Play,
  RotateCcw,
  Settings2,
} from 'lucide-react'

import type { WorkbenchScreen } from '../../../shared/types'

import { Button } from '../ui/button'
import {
  EXPERIENCE_SCREEN_LABELS,
  type DemoExperienceAction,
  type DemoExperienceSession,
} from './demo-experience-sessions'
import {
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceStatusChip,
} from './experience-ui'

type ExperienceDemoConsoleProps = {
  screen: WorkbenchScreen
  activeSession: DemoExperienceSession
  actionResult?: string
  eventCount: number
  lastActionId?: DemoExperienceAction['id']
  onRunAction: (action: DemoExperienceAction) => void
  layout?: 'stacked' | 'sidebar'
}

const ACTION_ICONS: Record<DemoExperienceAction['id'], React.ComponentType<{ className?: string }>> = {
  configure: Settings2,
  run: Play,
  expectations: ClipboardCheck,
  evidence: FileSearch,
  reset: RotateCcw,
}

export function ExperienceDemoConsole({
  screen,
  activeSession,
  actionResult,
  eventCount,
  lastActionId,
  onRunAction,
  layout = 'stacked',
}: ExperienceDemoConsoleProps) {
  const visibleActionResult = actionResult ?? `Готово к демо: ${activeSession.sourceSessionLabel}`
  const metricSnapshot = activeSession.truthState.metricSnapshots[0]
  const openRiskScore = metricSnapshot?.openRiskScore ?? 0

  return (
    <section
      aria-label={`Демо-контур ${EXPERIENCE_SCREEN_LABELS[screen]}`}
      className={
        layout === 'sidebar'
          ? 'min-h-0 overflow-y-auto border-r border-white/[0.08] bg-[#07090d] px-4 py-4'
          : 'shrink-0 border-b border-white/[0.08] bg-[#07090d] px-4 py-3 sm:px-6'
      }
    >
      <div className={layout === 'sidebar'
        ? 'grid gap-3'
        : 'grid gap-3 2xl:grid-cols-[minmax(260px,0.8fr)_minmax(520px,1.55fr)_minmax(260px,0.8fr)]'
      }>
        <ExperiencePanel
          title="Демо-контур"
          subtitle={`${activeSession.sourceSessionLabel} · ${EXPERIENCE_SCREEN_LABELS[screen]}`}
          tone="command"
        >
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{activeSession.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExperienceStatusChip status="ready" label={`VDI ${metricSnapshot?.verifiedDeliverableIndex ?? 0}`} />
            <ExperienceStatusChip status="success" label={`Readiness ${metricSnapshot?.executionReadiness ?? 0}`} />
            <ExperienceStatusChip status={openRiskScore > 16 ? 'warning' : 'success'} label={`Risk ${openRiskScore}`} />
          </div>
          <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-sm leading-6 text-cyan-100">
            {visibleActionResult}
          </div>
        </ExperiencePanel>

        <ExperiencePanel
          title="Как пользоваться"
          subtitle="Эти кнопки меняют видимый статус демо и показывают, что именно ожидать от сценария."
          tone="neutral"
        >
          <div className={layout === 'sidebar' ? 'mt-3 grid gap-3' : 'mt-3 grid gap-3 xl:grid-cols-3'}>
            <StepList title="Как пользоваться" steps={activeSession.usageSteps} />
            <StepList title="Как настраивать" steps={activeSession.setupSteps} />
            <StepList title="Что ожидать" steps={activeSession.expectedOutcomes} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {activeSession.demoActions.map((action) => {
              const ActionIcon = ACTION_ICONS[action.id]
              return (
                <Button
                  key={action.id}
                  type="button"
                  variant={action.id === 'run' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => onRunAction(action)}
                >
                  <ActionIcon className="h-4 w-4" />
                  {action.label}
                </Button>
              )
            })}
          </div>
        </ExperiencePanel>

        <ExperiencePanel title="MCP presets" subtitle="Что будет подключено для этого демо без сохранения секретов." tone="game">
          <ExperienceMetricRow
            label="Активный пакет"
            value={activeSession.truthState.agentPackages[0]?.name ?? 'demo package'}
          />
          <ExperienceMetricRow
            label="Mission status"
            value={activeSession.truthState.mission.status}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSession.mcpPresetIds.map((presetId) => (
              <span
                key={presetId}
                className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {presetId}
              </span>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.035] p-3 text-sm leading-6 text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Журнал действий</span>
              <ExperienceStatusChip status={eventCount > 0 ? 'running' : 'queued'} label={`${eventCount} событий`} />
            </div>
            <div className="mt-2 text-xs">
              Последнее действие: {lastActionId ? localizeActionId(lastActionId) : 'еще не запускалось'}
            </div>
          </div>
        </ExperiencePanel>
      </div>
    </section>
  )
}

function localizeActionId(actionId: DemoExperienceAction['id']): string {
  switch (actionId) {
    case 'configure':
      return 'настройка сценария'
    case 'run':
      return 'запуск демо'
    case 'expectations':
      return 'проверка ожиданий'
    case 'evidence':
      return 'запись evidence'
    case 'reset':
      return 'сброс'
    default:
      return actionId
  }
}

function StepList({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.035] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <ol className="mt-2 space-y-1.5 text-sm leading-5 text-muted-foreground">
        {steps.map((step, index) => (
          <li key={`${title}:${index}`} className="flex gap-2">
            <span className="shrink-0 text-cyan-100">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
