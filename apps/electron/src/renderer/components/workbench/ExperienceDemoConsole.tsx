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
  sessions: DemoExperienceSession[]
  activeSession: DemoExperienceSession
  onSelectSession: (sessionId: string) => void
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
  sessions,
  activeSession,
  onSelectSession,
}: ExperienceDemoConsoleProps) {
  const [actionResultBySessionId, setActionResultBySessionId] = React.useState<Record<string, string>>({})
  const actionResult = actionResultBySessionId[activeSession.id] ?? `Готово к демо: ${activeSession.sourceSessionLabel}`
  const metricSnapshot = activeSession.truthState.metricSnapshots[0]
  const openRiskScore = metricSnapshot?.openRiskScore ?? 0

  const runDemoAction = React.useCallback((action: DemoExperienceAction) => {
    setActionResultBySessionId((current) => ({
      ...current,
      [activeSession.id]: action.result,
    }))
  }, [activeSession.id])

  return (
    <section
      aria-label={`Демо-контур ${EXPERIENCE_SCREEN_LABELS[screen]}`}
      className="shrink-0 border-b border-white/[0.08] bg-[#07090d] px-4 py-3 sm:px-6"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(420px,1.4fr)_minmax(260px,0.85fr)]">
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
          <div className="mt-3 rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-sm leading-6 text-cyan-100">
            {actionResult}
          </div>
        </ExperiencePanel>

        <ExperiencePanel
          title="Как пользоваться"
          subtitle="Эти кнопки меняют видимый статус демо и показывают, что именно ожидать от сценария."
          tone="neutral"
        >
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
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
                  onClick={() => runDemoAction(action)}
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
          <div className="mt-4 grid gap-2">
            {sessions.map((session) => {
              const selected = session.id === activeSession.id
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={`rounded-[14px] border px-3 py-2 text-left text-xs transition ${
                    selected
                      ? 'border-cyan-300/45 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {session.sourceSessionLabel}
                </button>
              )
            })}
          </div>
        </ExperiencePanel>
      </div>
    </section>
  )
}

function StepList({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3">
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
