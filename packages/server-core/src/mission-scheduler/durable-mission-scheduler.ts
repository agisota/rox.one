import {
  evaluateMissionCompletion,
  MissionCheckpointSchema,
  MissionRunSchema,
  type MissionCheckpoint,
  type MissionGateResult,
  type MissionRun,
  type MissionRunStatus,
} from '@craft-agent/shared/workbench'

import type { MissionRunRepository, MissionSchedulerEvent } from '../persistence'

export interface MissionClock {
  now(): string
}

export interface MissionCheckpointExecutionInput {
  mission: MissionRun
  checkpoint: MissionCheckpoint
  now: string
}

export interface MissionCheckpointExecutionResult {
  summary: string
  artifactIds: string[]
  vdiDelta?: number
}

export interface MissionCheckpointExecutor {
  kind: 'fake' | 'real'
  execute(input: MissionCheckpointExecutionInput): Promise<MissionCheckpointExecutionResult>
}

export interface DurableMissionSchedulerOptions {
  repository: MissionRunRepository
  clock: MissionClock
  checkpointExecutor: MissionCheckpointExecutor
  checkpointCostCredits?: number
  maxSwarmAgents?: number
  approvalRequiredAgentCount?: number
  allowRealProviders?: boolean
}

export interface LaunchMissionInput {
  mission: MissionRun
  checkpoints?: MissionCheckpoint[]
}

export interface LaunchMissionResult {
  mission: MissionRun
  checkpoints: MissionCheckpoint[]
}

export interface SchedulerTickInput {
  missionRunId: string
}

export interface SchedulerTickResult {
  mission: MissionRun
  executedCheckpointIds: string[]
  blockedCheckpointIds: string[]
  skippedCheckpointIds: string[]
}

export interface FinalizeMissionInput {
  missionRunId: string
  elapsedHours: number
  finalArtifactId?: string
  requiredGateResults: MissionGateResult[]
  criticalOpenFindings: number
}

export type BranchExpansionDecisionReason =
  | 'approved'
  | 'budget_cap_exceeded'
  | 'capacity_exceeded'
  | 'human_approval_required'

export interface BranchExpansionDecision {
  allowed: boolean
  reason: BranchExpansionDecisionReason
  remainingBudgetCredits: number
}

export interface BranchExpansionInput {
  missionRunId: string
  requestedAgentCount: number
  estimatedCostCredits: number
  humanApproval?: {
    id: string
    status: 'pending' | 'approved' | 'rejected'
  }
}

export class DurableMissionScheduler {
  private readonly repository: MissionRunRepository
  private readonly clock: MissionClock
  private readonly checkpointExecutor: MissionCheckpointExecutor
  private readonly checkpointCostCredits: number
  private readonly maxSwarmAgents: number
  private readonly approvalRequiredAgentCount: number
  private readonly allowRealProviders: boolean

  constructor(options: DurableMissionSchedulerOptions) {
    this.repository = options.repository
    this.clock = options.clock
    this.checkpointExecutor = options.checkpointExecutor
    this.checkpointCostCredits = options.checkpointCostCredits ?? 12
    this.maxSwarmAgents = options.maxSwarmAgents ?? 12
    this.approvalRequiredAgentCount = options.approvalRequiredAgentCount ?? 100
    this.allowRealProviders = options.allowRealProviders ?? false
  }

  async launchMission(input: LaunchMissionInput): Promise<LaunchMissionResult> {
    const now = this.clock.now()
    const mission = MissionRunSchema.parse({
      ...input.mission,
      status: 'queued',
      startedAt: input.mission.startedAt ?? now,
    })
    const savedMission = await this.repository.saveMissionRun(mission)
    const checkpoints = input.checkpoints?.map(checkpoint => MissionCheckpointSchema.parse(checkpoint))
      ?? createMissionCheckpoints(savedMission)

    const savedCheckpoints: MissionCheckpoint[] = []
    for (const checkpoint of checkpoints) {
      savedCheckpoints.push(await this.repository.saveMissionCheckpoint(checkpoint))
    }
    await this.appendEvent(savedMission.id, undefined, 'mission_queued', {
      checkpointCount: savedCheckpoints.length,
      selectedAgentCount: savedMission.selectedAgentPackageIds.length,
    })

    return { mission: savedMission, checkpoints: savedCheckpoints }
  }

  async tick(input: SchedulerTickInput): Promise<SchedulerTickResult> {
    const mission = await this.requireMission(input.missionRunId)
    const now = this.clock.now()
    const checkpoints = await this.repository.listMissionCheckpoints(mission.id)
    const result: SchedulerTickResult = {
      mission,
      executedCheckpointIds: [],
      blockedCheckpointIds: [],
      skippedCheckpointIds: [],
    }

    if (!isExecutableMissionStatus(mission.status)) {
      result.skippedCheckpointIds = checkpoints.map(checkpoint => checkpoint.id)
      return result
    }

    for (const checkpoint of checkpoints) {
      if (checkpoint.status !== 'queued' || !isDue(checkpoint.dueAt, now)) {
        result.skippedCheckpointIds.push(checkpoint.id)
        continue
      }

      const idempotencyKey = checkpointIdempotencyKey(mission.id, checkpoint.id)
      if (await this.repository.hasExecutedCheckpoint(idempotencyKey)) {
        result.skippedCheckpointIds.push(checkpoint.id)
        continue
      }

      this.assertProviderAllowed()

      const remainingBudgetCredits = await this.getRemainingBudgetCredits(mission)
      if (remainingBudgetCredits < this.checkpointCostCredits) {
        await this.repository.saveMissionRun({ ...mission, status: 'paused' })
        await this.repository.saveMissionCheckpoint({
          ...checkpoint,
          status: 'blocked',
          summary: `Budget exhausted before ${checkpoint.title}.`,
        })
        await this.appendEvent(mission.id, checkpoint.id, 'checkpoint_budget_blocked', {
          remainingBudgetCredits,
          checkpointCostCredits: this.checkpointCostCredits,
        })
        result.blockedCheckpointIds.push(checkpoint.id)
        continue
      }

      if (mission.status === 'queued') {
        await this.repository.saveMissionRun({ ...mission, status: 'running' })
      }

      const execution = await this.checkpointExecutor.execute({ mission, checkpoint, now })
      const savedCheckpoint = await this.repository.saveMissionCheckpoint({
        ...checkpoint,
        completedAt: now,
        status: 'completed',
        summary: execution.summary,
        artifactIds: execution.artifactIds,
        vdiDelta: execution.vdiDelta ?? checkpoint.vdiDelta,
      })

      await this.repository.recordExecutedCheckpoint(idempotencyKey)
      await this.appendEvent(mission.id, checkpoint.id, 'checkpoint_completed', {
        artifactIds: savedCheckpoint.artifactIds,
        costCredits: this.checkpointCostCredits,
        vdiDelta: savedCheckpoint.vdiDelta,
      })
      result.executedCheckpointIds.push(checkpoint.id)
    }

    return result
  }

  async finalizeMission(input: FinalizeMissionInput) {
    const mission = await this.requireMission(input.missionRunId)
    const gateEvidenceReasons = findGateEvidenceReasons(input.requiredGateResults)
    const completion = evaluateMissionCompletion({
      missionId: mission.id,
      elapsedHours: input.elapsedHours,
      durationHours: mission.durationHours,
      finalArtifactId: input.finalArtifactId,
      requiredGateResults: input.requiredGateResults,
      criticalOpenFindings: input.criticalOpenFindings,
      blocked: gateEvidenceReasons.length > 0,
    })
    const reasons = [...new Set([...completion.reasons, ...gateEvidenceReasons])]
    const decision = reasons.length > 0 && completion.decision === 'pass' ? 'fail' : completion.decision

    if (decision === 'pass' || decision === 'warn') {
      await this.repository.saveMissionRun({
        ...mission,
        status: 'completed',
        completedAt: this.clock.now(),
      })
      await this.appendEvent(mission.id, undefined, 'mission_completed', {
        decision,
        finalArtifactId: input.finalArtifactId,
      })
    } else {
      await this.appendEvent(mission.id, undefined, 'mission_finalization_blocked', {
        decision,
        reasons,
        finalArtifactId: input.finalArtifactId,
      })
    }

    return {
      missionId: mission.id,
      decision,
      reasons,
    }
  }

  async evaluateBranchExpansion(input: BranchExpansionInput): Promise<BranchExpansionDecision> {
    const mission = await this.requireMission(input.missionRunId)
    const remainingBudgetCredits = await this.getRemainingBudgetCredits(mission)

    if (input.requestedAgentCount > this.maxSwarmAgents) {
      await this.blockBranchExpansion(mission, 'capacity_exceeded', {
        requestedAgentCount: input.requestedAgentCount,
        maxSwarmAgents: this.maxSwarmAgents,
      })
      return { allowed: false, reason: 'capacity_exceeded', remainingBudgetCredits }
    }

    if (input.estimatedCostCredits > remainingBudgetCredits) {
      await this.blockBranchExpansion(mission, 'budget_cap_exceeded', {
        estimatedCostCredits: input.estimatedCostCredits,
        remainingBudgetCredits,
      })
      return { allowed: false, reason: 'budget_cap_exceeded', remainingBudgetCredits }
    }

    if (
      input.requestedAgentCount >= this.approvalRequiredAgentCount
      && input.humanApproval?.status !== 'approved'
    ) {
      await this.repository.saveMissionRun({ ...mission, status: 'waiting_for_approval' })
      await this.appendEvent(mission.id, undefined, 'branch_expansion_waiting_for_approval', {
        requestedAgentCount: input.requestedAgentCount,
        approvalRequiredAgentCount: this.approvalRequiredAgentCount,
        approvalId: input.humanApproval?.id ?? null,
      })
      return { allowed: false, reason: 'human_approval_required', remainingBudgetCredits }
    }

    await this.repository.saveMissionRun({ ...mission, status: 'running' })
    await this.appendEvent(mission.id, undefined, 'branch_expansion_approved', {
      requestedAgentCount: input.requestedAgentCount,
      estimatedCostCredits: input.estimatedCostCredits,
      approvalId: input.humanApproval?.id ?? null,
    })
    return { allowed: true, reason: 'approved', remainingBudgetCredits }
  }

  private async blockBranchExpansion(
    mission: MissionRun,
    reason: Exclude<BranchExpansionDecisionReason, 'approved' | 'human_approval_required'>,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.repository.saveMissionRun({ ...mission, status: 'paused' })
    await this.appendEvent(mission.id, undefined, 'branch_expansion_blocked', { reason, ...payload })
  }

  private async requireMission(missionRunId: string): Promise<MissionRun> {
    const mission = await this.repository.getMissionRun(missionRunId)
    if (!mission) throw new Error(`Mission not found: ${missionRunId}`)
    return mission
  }

  private async getRemainingBudgetCredits(mission: MissionRun): Promise<number> {
    const events = await this.repository.listMissionSchedulerEvents(mission.id)
    const spentCredits = events.reduce((total, event) => total + getEventCostCredits(event), 0)
    return Math.max(0, mission.budgetCapCredits - spentCredits)
  }

  private assertProviderAllowed(): void {
    if (this.checkpointExecutor.kind === 'real' && !this.allowRealProviders) {
      throw new Error('Real checkpoint providers are disabled')
    }
  }

  private async appendEvent(
    missionRunId: string,
    checkpointId: string | undefined,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<MissionSchedulerEvent> {
    const event: MissionSchedulerEvent = {
      id: createEventId(missionRunId, checkpointId, type),
      missionRunId,
      ...(checkpointId ? { checkpointId } : {}),
      type,
      createdAt: this.clock.now(),
      payload,
    }
    return this.repository.appendMissionSchedulerEvent(event)
  }
}

export function createDurableMissionScheduler(options: DurableMissionSchedulerOptions): DurableMissionScheduler {
  return new DurableMissionScheduler(options)
}

function createMissionCheckpoints(mission: MissionRun): MissionCheckpoint[] {
  const checkpointCount = mission.durationHours / mission.checkpointCadenceHours
  return Array.from({ length: checkpointCount }, (_, index) => {
    const ordinal = index + 1
    const dueHour = ordinal * mission.checkpointCadenceHours
    const id = `${mission.id}:cp-${dueHour}h`
    return MissionCheckpointSchema.parse({
      id,
      missionRunId: mission.id,
      ordinal,
      dueAt: addHours(mission.startedAt ?? mission.createdAt, dueHour),
      title: dueHour >= mission.durationHours ? 'Final verification' : `Checkpoint ${dueHour}h`,
      summary: '',
      artifactIds: [],
      vdiDelta: 0,
      status: 'queued',
    })
  })
}

function isExecutableMissionStatus(status: MissionRunStatus): boolean {
  return status === 'queued' || status === 'running'
}

function isDue(dueAt: string, now: string): boolean {
  return Date.parse(dueAt) <= Date.parse(now)
}

function addHours(isoDate: string, hours: number): string {
  return new Date(Date.parse(isoDate) + hours * 60 * 60 * 1000).toISOString()
}

function checkpointIdempotencyKey(missionRunId: string, checkpointId: string): string {
  return `${missionRunId}:${checkpointId}`
}

function findGateEvidenceReasons(gateResults: MissionGateResult[]): string[] {
  return gateResults.some(result => result.status === 'pass' && !result.evidenceRef)
    ? ['missing_gate_evidence']
    : []
}

function getEventCostCredits(event: MissionSchedulerEvent): number {
  const costCredits = event.payload.costCredits
  return typeof costCredits === 'number' && Number.isFinite(costCredits) ? costCredits : 0
}

function createEventId(missionRunId: string, checkpointId: string | undefined, type: string): string {
  return [
    'event',
    missionRunId,
    checkpointId?.replaceAll(':', '-') ?? 'mission',
    type,
  ].join(':')
}
