import { describe, expect, it } from 'bun:test'

import {
  projectMissionRunStatusFromSchedulerEvents,
  type MissionGateResult,
  type MissionRun,
} from '@craft-agent/shared/workbench'
import { createInMemoryAgentWorkbenchPersistenceAdapter } from '../../persistence'
import {
  createDurableMissionScheduler,
  type MissionCheckpointExecutor,
} from '../durable-mission-scheduler'

const STARTED_AT = '2026-05-06T00:00:00.000Z'
const CHECKPOINT_6H = '2026-05-06T06:00:00.000Z'
const CHECKPOINT_24H = '2026-05-07T00:00:00.000Z'

describe('DurableMissionScheduler', () => {
  it('persists a mission and generated checkpoints before execution', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(STARTED_AT),
      checkpointExecutor: fakeCheckpointExecutor(),
    })
    const mission = createMission({ id: 'mission-persisted', selectedAgentCount: 4 })

    await scheduler.launchMission({ mission })

    const savedMission = await adapter.missions.getMissionRun(mission.id)
    const checkpoints = await adapter.missions.listMissionCheckpoints(mission.id)
    const events = await adapter.missions.listMissionSchedulerEvents(mission.id)

    expect(savedMission).toMatchObject({ id: mission.id, status: 'queued', startedAt: STARTED_AT })
    expect(checkpoints.map(checkpoint => checkpoint.id)).toEqual([
      'mission-persisted:cp-6h',
      'mission-persisted:cp-12h',
      'mission-persisted:cp-18h',
      'mission-persisted:cp-24h',
    ])
    expect(checkpoints[0]).toMatchObject({ dueAt: CHECKPOINT_6H, status: 'queued' })
    expect(events).toContainEqual(expect.objectContaining({ type: 'mission_queued', missionRunId: mission.id }))
  })

  it('recovers queued checkpoint jobs after scheduler restart', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const mission = createMission({ id: 'mission-restart', selectedAgentCount: 4 })

    await createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(STARTED_AT),
      checkpointExecutor: fakeCheckpointExecutor(),
    }).launchMission({ mission })

    const executor = fakeCheckpointExecutor()
    const restartedScheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: executor,
    })

    const tick = await restartedScheduler.tick({ missionRunId: mission.id })

    const checkpoints = await adapter.missions.listMissionCheckpoints(mission.id)
    const events = await adapter.missions.listMissionSchedulerEvents(mission.id)

    expect(executor.calls).toEqual(['mission-restart:cp-6h'])
    expect(executor.missionStatuses).toEqual(['running'])
    expect(tick.mission.status).toBe('running')
    expect(checkpoints.find(checkpoint => checkpoint.id === 'mission-restart:cp-6h')).toMatchObject({
      status: 'completed',
      completedAt: CHECKPOINT_6H,
      artifactIds: ['artifact:mission-restart:cp-6h'],
    })
    expect(events).toContainEqual(expect.objectContaining({
      type: 'checkpoint_completed',
      checkpointId: 'mission-restart:cp-6h',
    }))
    expect(projectMissionRunStatusFromSchedulerEvents(mission, events)).toBe('running')
  })

  it('executes duplicate checkpoint ticks idempotently', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const mission = createMission({ id: 'mission-idempotent', selectedAgentCount: 4 })
    await createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(STARTED_AT),
      checkpointExecutor: fakeCheckpointExecutor(),
    }).launchMission({ mission })

    const executor = fakeCheckpointExecutor()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: executor,
    })

    await scheduler.tick({ missionRunId: mission.id })
    await scheduler.tick({ missionRunId: mission.id })

    const events = await adapter.missions.listMissionSchedulerEvents(mission.id)

    expect(executor.calls).toEqual(['mission-idempotent:cp-6h'])
    expect(events.filter(event => event.type === 'checkpoint_completed' && event.checkpointId === 'mission-idempotent:cp-6h')).toHaveLength(1)
    expect(await adapter.missions.hasExecutedCheckpoint('mission-idempotent:mission-idempotent:cp-6h')).toBe(true)
  })

  it('does not complete a mission from elapsed time alone', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_24H),
      checkpointExecutor: fakeCheckpointExecutor(),
    })
    const mission = createMission({ id: 'mission-elapsed', selectedAgentCount: 4 })
    await scheduler.launchMission({ mission })

    const finalization = await scheduler.finalizeMission({
      missionRunId: mission.id,
      elapsedHours: 24,
      requiredGateResults: passingGateResults(),
      criticalOpenFindings: 0,
    })

    expect(finalization.decision).toBe('fail')
    expect(finalization.reasons).toContain('missing_final_artifact')
    expect(finalization.reasons).toContain('elapsed_time_without_evidence')
    expect((await adapter.missions.getMissionRun(mission.id))?.status).not.toBe('completed')
  })

  it('requires artifact and gate evidence before final completion', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_24H),
      checkpointExecutor: fakeCheckpointExecutor(),
    })
    const mission = createMission({ id: 'mission-evidence', selectedAgentCount: 4 })
    await scheduler.launchMission({ mission })

    const missingGateEvidence = await scheduler.finalizeMission({
      missionRunId: mission.id,
      elapsedHours: 24,
      finalArtifactId: 'artifact:mission-evidence-final',
      requiredGateResults: [{ gateId: 'schema', status: 'pass', blocking: true }],
      criticalOpenFindings: 0,
    })
    const payloadOnlyArtifact = await scheduler.finalizeMission({
      missionRunId: mission.id,
      elapsedHours: 24,
      finalArtifactId: 'artifact:mission-evidence-final',
      requiredGateResults: passingGateResults(),
      criticalOpenFindings: 0,
    })
    const checkpoints = await adapter.missions.listMissionCheckpoints(mission.id)
    const finalCheckpoint = checkpoints.at(-1)
    expect(finalCheckpoint).toBeDefined()
    await adapter.missions.saveMissionCheckpoint({
      ...finalCheckpoint!,
      status: 'completed',
      completedAt: CHECKPOINT_24H,
      artifactIds: ['artifact:mission-evidence-final'],
    })
    const withEvidence = await scheduler.finalizeMission({
      missionRunId: mission.id,
      elapsedHours: 24,
      finalArtifactId: 'artifact:mission-evidence-final',
      requiredGateResults: passingGateResults(),
      criticalOpenFindings: 0,
    })

    expect(missingGateEvidence.decision).toBe('fail')
    expect(missingGateEvidence.reasons).toContain('missing_gate_evidence')
    expect(payloadOnlyArtifact.decision).toBe('fail')
    expect(payloadOnlyArtifact.reasons).toContain('missing_stored_final_artifact')
    expect(withEvidence.decision).toBe('pass')
    expect(await adapter.missions.getMissionRun(mission.id)).toMatchObject({
      status: 'completed',
      completedAt: CHECKPOINT_24H,
    })
  })

  it('blocks branch expansion when budget or capacity gates fail', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: fakeCheckpointExecutor(),
      maxSwarmAgents: 12,
    })
    const mission = createMission({ id: 'mission-capacity', selectedAgentCount: 4, budgetCapCredits: 30 })
    await scheduler.launchMission({ mission })

    const budgetDenied = await scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 8,
      estimatedCostCredits: 90,
    })
    const capacityDenied = await scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 18,
      estimatedCostCredits: 10,
    })

    expect(budgetDenied).toMatchObject({ allowed: false, reason: 'budget_cap_exceeded' })
    expect(capacityDenied).toMatchObject({ allowed: false, reason: 'capacity_exceeded' })
    expect((await adapter.missions.getMissionRun(mission.id))?.status).toBe('paused')
  })

  it('does not let spoofed negative scheduler event costs expand mission budget', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: fakeCheckpointExecutor(),
      maxSwarmAgents: 12,
    })
    const mission = createMission({ id: 'mission-budget-spoof', selectedAgentCount: 4, budgetCapCredits: 30 })
    await scheduler.launchMission({ mission })
    await adapter.missions.appendMissionSchedulerEvent({
      id: 'event:mission-budget-spoof:spoofed-negative-cost',
      missionRunId: mission.id,
      type: 'checkpoint_completed',
      createdAt: CHECKPOINT_6H,
      payload: { costCredits: -1_000 },
    })

    const budgetDenied = await scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 8,
      estimatedCostCredits: 45,
    })

    expect(budgetDenied).toMatchObject({
      allowed: false,
      reason: 'budget_cap_exceeded',
      remainingBudgetCredits: 30,
    })
    expect((await adapter.missions.getMissionRun(mission.id))?.status).toBe('paused')
  })

  it('rejects invalid branch expansion values before budget or approval checks', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: fakeCheckpointExecutor(),
      maxSwarmAgents: 12,
    })
    const mission = createMission({ id: 'mission-invalid-expansion', selectedAgentCount: 4, budgetCapCredits: 30 })
    await scheduler.launchMission({ mission })

    await expect(scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 0,
      estimatedCostCredits: 10,
    })).rejects.toThrow('Branch expansion requestedAgentCount must be a positive integer.')
    await expect(scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 4.5,
      estimatedCostCredits: 10,
    })).rejects.toThrow('Branch expansion requestedAgentCount must be a positive integer.')
    await expect(scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 4,
      estimatedCostCredits: 0,
    })).rejects.toThrow('Branch expansion estimatedCostCredits must be a positive finite number.')
    await expect(scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 4,
      estimatedCostCredits: Number.POSITIVE_INFINITY,
    })).rejects.toThrow('Branch expansion estimatedCostCredits must be a positive finite number.')

    expect((await adapter.missions.getMissionRun(mission.id))?.status).toBe('queued')
  })

  it('blocks 100-agent swarm expansion until human approval exists', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: fakeCheckpointExecutor(),
      maxSwarmAgents: 120,
      approvalRequiredAgentCount: 100,
    })
    const mission = createMission({ id: 'mission-approval', selectedAgentCount: 12, budgetCapCredits: 1_000 })
    await scheduler.launchMission({ mission })

    const pending = await scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 100,
      estimatedCostCredits: 250,
    })
    expect((await adapter.missions.getMissionRun(mission.id))?.status).toBe('waiting_for_approval')

    const approved = await scheduler.evaluateBranchExpansion({
      missionRunId: mission.id,
      requestedAgentCount: 100,
      estimatedCostCredits: 250,
      humanApproval: { id: 'approval-100-agent-swarm', status: 'approved' },
    })

    expect(pending).toMatchObject({ allowed: false, reason: 'human_approval_required' })
    expect(approved).toMatchObject({ allowed: true, reason: 'approved' })
  })

  it('refuses real checkpoint providers in tests by default', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const mission = createMission({ id: 'mission-provider-guard', selectedAgentCount: 4 })
    await createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(STARTED_AT),
      checkpointExecutor: fakeCheckpointExecutor(),
    }).launchMission({ mission })

    let realProviderCalls = 0
    const scheduler = createDurableMissionScheduler({
      repository: adapter.missions,
      clock: fakeClock(CHECKPOINT_6H),
      checkpointExecutor: {
        kind: 'real',
        async execute() {
          realProviderCalls += 1
          return { summary: 'real provider must not run', artifactIds: [] }
        },
      },
    })

    await expect(scheduler.tick({ missionRunId: mission.id })).rejects.toThrow('Real checkpoint providers are disabled')

    expect(realProviderCalls).toBe(0)
  })
})

function fakeClock(now: string) {
  return { now: () => now }
}

function fakeCheckpointExecutor(): MissionCheckpointExecutor & { calls: string[]; missionStatuses: MissionRun['status'][] } {
  const calls: string[] = []
  const missionStatuses: MissionRun['status'][] = []
  return {
    kind: 'fake',
    calls,
    missionStatuses,
    async execute(input) {
      calls.push(input.checkpoint.id)
      missionStatuses.push(input.mission.status)
      return {
        summary: `Deterministic checkpoint ${input.checkpoint.title}`,
        artifactIds: [`artifact:${input.checkpoint.id}`],
        vdiDelta: 2,
      }
    },
  }
}

function passingGateResults(): MissionGateResult[] {
  return [
    { gateId: 'schema', status: 'pass', blocking: true, evidenceRef: 'gate:schema:passed' },
    { gateId: 'logic_check', status: 'pass', blocking: true, evidenceRef: 'gate:logic_check:passed' },
    { gateId: 'fact_check', status: 'pass', blocking: true, evidenceRef: 'gate:fact_check:passed' },
  ]
}

function createMission(input: {
  id: string
  selectedAgentCount: number
  budgetCapCredits?: number
}): MissionRun {
  return {
    id: input.id,
    ownerUserId: 'user-one',
    teamId: 'team-one',
    workspaceId: 'workspace-main',
    mode: 'deep_run',
    experienceLayer: 'command',
    title: '24h durable scheduler run',
    objective: 'Produce a verified blocker map and final fix plan.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status: 'draft',
    vdiTarget: 85,
    budgetCapCredits: input.budgetCapCredits ?? 500,
    tokenCap: 1_000_000,
    storageCapBytes: 1_073_741_824,
    selectedAgentPackageIds: Array.from({ length: input.selectedAgentCount }, (_, index) => `agent-${index + 1}`),
    requiredGateIds: ['schema', 'logic_check', 'fact_check'],
    createdAt: STARTED_AT,
  }
}
