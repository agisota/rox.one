import { describe, expect, test } from 'bun:test'

import {
  createExperienceRuntimeStore,
  createInMemoryExperiencePersistenceAdapter,
} from '@rox-agent/shared/workbench'
import {
  createDeepMissionEntryState,
  createDeepMissionLaunchPlan,
  createFakeDeepMissionDraftPersistenceAdapter,
  createFakeDeepMissionSchedulerAdapter,
} from '../deep-missions-state'
import {
  createAgentForgeState,
  installAgentPackage,
  publishAgentPackage,
} from '../agent-forge-state'
import {
  completeQuestAndEvaluateUnlocks,
  createQuestMapState,
} from '../quest-map-state'
import {
  createArenaBuilderState,
  createArenaDraftRun,
  toggleArenaAgentSelection,
} from '../arena-builder-state'
import {
  appendProgressLedgerEvent,
  createProgressionState,
} from '../progression-observatory-state'
import {
  approveMissionBranch,
  completeMissionCheckpointFromControlAction,
  createMissionControlState,
  finalizeMissionFromControlAction,
  transitionMissionCheckpoint,
} from '../mission-control-state'

describe('Workbench interactive state mutations', () => {
  test('launches a deep mission through runtime store and fake scheduler', async () => {
    const runtimeStore = await createExperienceRuntimeStore({
      adapter: createInMemoryExperiencePersistenceAdapter(),
    })
    const draftPersistence = createFakeDeepMissionDraftPersistenceAdapter()
    const scheduler = createFakeDeepMissionSchedulerAdapter()
    const state = createDeepMissionEntryState({
      rawInput: 'ship verified RC',
      title: 'ROX.ONE RC verification',
      objective: 'produce verified release evidence',
      budgetCapCredits: 100,
      tokenCap: 100_000,
      storageCapBytes: 1024,
      selectedAgentCount: 4,
      vdiTarget: 85,
    })

    const plan = await createDeepMissionLaunchPlan(state, {
      now: '2026-04-30T00:00:00.000Z',
      actorId: 'user-one',
      ownerUserId: 'user-one',
      workspaceId: 'workspace-rox',
      teamId: 'team-alpha',
      draftPersistence,
      scheduler,
      runtimeStore,
    })

    expect(plan.status).toBe('launched')
    expect(plan.events.map((event) => event.type)).toEqual(['mission.drafted', 'mission.launched'])
    expect(draftPersistence.savedDrafts).toHaveLength(1)
    expect(scheduler.launchedMissions).toHaveLength(1)
    expect(runtimeStore.getState().activeMissionId).toBe(plan.mission.id)
    expect(runtimeStore.getState().checkpoints).toHaveLength(plan.checkpoints.length)
  })

  test('mutates mission control checkpoint and approval lifecycle through local state', () => {
    const initial = createMissionControlState()
    const checkpointId = initial.checkpoints[0].id
    const completed = transitionMissionCheckpoint(initial, checkpointId, 'completed')
    const approved = approveMissionBranch(completed, initial.approvals[0].id)

    expect(completed.checkpoints.find((checkpoint) => checkpoint.id === checkpointId)?.status).toBe('completed')
    expect(completed.auditEvents.some((event) => event.id.includes(checkpointId))).toBe(true)
    expect(approved.approvals[0].status).toBe('approved')
    expect(approved.blockingReasons.join('\n')).not.toContain('Approval required')
  })

  test('mission control records artifact, passing gate, ledger and finalizes only with evidence', async () => {
    const runtimeStore = await createExperienceRuntimeStore({
      adapter: createInMemoryExperiencePersistenceAdapter(),
    })
    const base = createMissionControlState()
    const finalCheckpoint = base.checkpoints[base.checkpoints.length - 1]
    const finalArtifactId = 'artifact:mission-24h-launch-review:final-evidence'
    const ready = createMissionControlState({
      ...base,
      checkpoints: base.checkpoints.map((checkpoint) => ({ ...checkpoint, status: 'completed' as const })),
      gateResults: base.mission.requiredGateIds.map((gateId) => ({
        gateId,
        status: 'pass' as const,
        evidenceRef: `gate:${gateId}:passed`,
      })),
      approvals: base.approvals.map((approval) => ({ ...approval, status: 'approved' as const })),
      artifacts: base.artifacts.concat({
        id: finalArtifactId,
        checkpointId: finalCheckpoint.id,
        title: 'Final verification evidence',
        artifactType: 'report',
        validationState: 'passed',
      }),
    })

    await runtimeStore.dispatch({
      id: 'event:test:mission-launched',
      type: 'mission.launched',
      createdAt: '2026-04-30T00:00:00.000Z',
      aggregateId: ready.mission.id,
      payload: {
        mission: ready.mission,
        checkpoints: ready.checkpoints,
      },
    })
    const afterCheckpoint = await completeMissionCheckpointFromControlAction(ready, {
      runtimeStore,
      checkpointId: finalCheckpoint.id,
      now: '2026-04-30T24:00:00.000Z',
      artifactId: finalArtifactId,
      artifactTitle: 'Final verification evidence',
      gateId: 'security_check',
      gateEvidenceRef: 'gate:security_check:passed',
      costCredits: 12,
    })
    const finalized = await finalizeMissionFromControlAction(afterCheckpoint, {
      runtimeStore,
      now: '2026-05-01T00:00:00.000Z',
    })

    expect(runtimeStore.getState().artifacts.some((artifact) => artifact.id === finalArtifactId)).toBe(true)
    expect(runtimeStore.getState().gateResults.some((gate) => gate.evidenceRef === 'gate:security_check:passed')).toBe(true)
    expect(runtimeStore.getState().ledger.some((entry) => entry.sourceArtifactId === finalArtifactId)).toBe(true)
    expect(finalized.mission.status).toBe('completed')
  })

  test('mission control does not dispatch finalization while evidence gates are missing', async () => {
    const runtimeStore = await createExperienceRuntimeStore({
      adapter: createInMemoryExperiencePersistenceAdapter(),
    })
    const blocked = createMissionControlState()

    await runtimeStore.dispatch({
      id: 'event:test:blocked-mission-launched',
      type: 'mission.launched',
      createdAt: '2026-04-30T00:00:00.000Z',
      aggregateId: blocked.mission.id,
      payload: {
        mission: blocked.mission,
        checkpoints: blocked.checkpoints,
      },
    })
    const afterFinalizeAttempt = await finalizeMissionFromControlAction(blocked, {
      runtimeStore,
      now: '2026-05-01T00:00:00.000Z',
    })

    expect(afterFinalizeAttempt.mission.status).not.toBe('completed')
    expect(runtimeStore.getState().missions.find((mission) => mission.id === blocked.mission.id)?.status).not.toBe('completed')
    expect(runtimeStore.getState().notifications.some((notification) =>
      notification.kind === 'error' && notification.message.includes('finalization'),
    )).toBe(false)
  })

  test('arena selector mutates selected agents, warnings and draft run estimate', () => {
    const initial = createArenaBuilderState({ entitlement: { maxSwarmSlots: 2 } })
    const withArchitect = toggleArenaAgentSelection(initial, 'agent-architect')
    const withSkeptic = toggleArenaAgentSelection(withArchitect, 'agent-skeptic')
    const overLimit = toggleArenaAgentSelection(withSkeptic, 'agent-researcher')
    const lockedAttempt = toggleArenaAgentSelection(withSkeptic, 'agent-locked-redteam')
    const draft = createArenaDraftRun(withSkeptic)

    expect(withArchitect.selectedAgentPackageIds).toEqual(['agent-architect'])
    expect(withSkeptic.runEstimate.swarmSlotsUsed).toBe(2)
    expect(overLimit.selectionWarnings.join('\n')).toContain('Swarm selection is capped')
    expect(lockedAttempt.selectionWarnings.join('\n')).toContain('locked and cannot be selected')
    expect(draft.mode).toBe('swarm_arena')
    expect(draft.selectedAgentPackageIds).toEqual(['agent-architect', 'agent-skeptic'])
    expect(draft.budgetEstimateCredits).toBe(withSkeptic.runEstimate.budgetEstimateCredits)
  })

  test('installs trusted forge package and blocks package without contract', () => {
    const state = createAgentForgeState()
    const installed = installAgentPackage(state, 'pkg-team-critic')

    expect(installed.installedPackageIds).toContain('pkg-team-critic')
    expect(() => installAgentPackage(state, 'pkg-no-contract')).toThrow('skill contract')
  })

  test('public forge publish enforces prompt-injection and trust checks', () => {
    const state = createAgentForgeState()
    const published = publishAgentPackage(state, 'pkg-team-critic', 'public')

    expect(published.packages.find((pkg) => pkg.id === 'pkg-team-critic')?.visibility).toBe('public')
    expect(() => publishAgentPackage(state, 'pkg-injection-risk', 'public')).toThrow()
  })

  test('completes quest, evaluates unlocks, and rejects locked quest completion', () => {
    const initial = createQuestMapState()
    const completed = completeQuestAndEvaluateUnlocks(initial, 'quest-frame-raw-prompt', ['artifact:quest-frame-raw-prompt:evidence'])

    expect(completed.progressByQuestId['quest-frame-raw-prompt'].status).toBe('completed')
    expect(completed.progressByQuestId['quest-rewrite-prompt'].status).toBe('available')
    expect(completed.unlockedRewardIds).toContain('skill:spec-builder')
    expect(() => completeQuestAndEvaluateUnlocks(initial, 'quest-rewrite-prompt', ['artifact:locked:evidence'])).toThrow('Locked quests')
  })

  test('records progression ledger entries from evidence actions', () => {
    const initial = createProgressionState()
    const updated = appendProgressLedgerEvent(initial, {
      id: 'ledger-xp-interaction-test',
      userId: 'user-one',
      teamId: 'team-alpha',
      eventType: 'xp',
      amount: 25,
      currency: 'xp',
      reason: 'Interactive evidence checkpoint accepted',
      sourceArtifactId: 'artifact:interactive-checkpoint-evidence',
      createdAt: '2026-04-30T00:00:00.000Z',
    })

    expect(updated.ledger).toHaveLength(initial.ledger.length + 1)
    expect(updated.ledger[updated.ledger.length - 1]?.sourceArtifactId).toBe('artifact:interactive-checkpoint-evidence')
  })
})
