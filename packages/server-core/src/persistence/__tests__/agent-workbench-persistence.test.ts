import { describe, expect, it } from 'bun:test'
import { Buffer } from 'node:buffer'

import {
  createInMemoryAgentWorkbenchPersistenceAdapter,
  type MissionSchedulerEvent,
} from '../agent-workbench-persistence'
import type { AgentPackage, MissionRun } from '@rox-one/shared/workbench'

const createdAt = '2026-05-05T12:00:00.000Z'

describe('AgentWorkbenchPersistenceAdapter contract', () => {
  it('exposes account, team, ledger, audit, storage, and sync seams behind one adapter', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()

    await adapter.accounts.migrate()
    const user = await adapter.accounts.createUser({
      email: 'USER@Example.COM',
      password: 'correct horse battery staple',
      displayName: 'User One',
    })
    const session = await adapter.accounts.createSession({ userId: user.id, authMethod: 'password' })

    expect(user.email).toBe('user@example.com')
    expect(await adapter.accounts.getUserCount()).toBe(1)
    expect(await adapter.accounts.verifyPassword('user@example.com', 'correct horse battery staple')).toMatchObject({ id: user.id })
    expect(await adapter.accounts.getSessionIdentity(session.id)).toMatchObject({ userId: user.id, email: user.email })

    const organization = await adapter.teams.createOrganization({ actorUserId: user.id, name: 'ROX Core' })
    const workspace = await adapter.cloudWorkspaces.createTeamWorkspace({
      ownerUserId: user.id,
      teamId: organization.id,
      name: 'Release Lab',
    })
    await adapter.ledger.recordCredit({
      userId: user.id,
      amountUnits: 1_000_000,
      reason: 'test_top_up',
      idempotencyKey: 'credit-001',
    })

    await adapter.audit.append({
      userId: user.id,
      teamId: organization.id,
      type: 'mission',
      title: 'Sensitive event',
      details: { apiKey: 'sk-secret', note: 'Bearer abc123' },
    })

    const scope = { type: 'team' as const, id: organization.id, quotaBytes: 32 }
    await adapter.storage.putObject(scope, 'runs/mission.md', new TextEncoder().encode('hello'))
    const sync = await adapter.workspaceSync.push({
      actorUserId: user.id,
      workspace,
      operationId: 'sync-001',
      files: [{ path: 'mission.md', contentBase64: Buffer.from('mission').toString('base64') }],
    })

    expect((await adapter.ledger.getBalance(user.id)).balanceUnits).toBe(1_000_000)
    expect((await adapter.audit.listForTeam(organization.id))[0]?.details).toMatchObject({
      apiKey: '[redacted]',
      note: 'Bearer [redacted]',
    })
    expect((await adapter.storage.getUsage(scope)).usedBytes).toBe(5)
    expect(sync.idempotentReplay).toBe(false)
    expect((await adapter.workspaceSync.listOperations({ actorUserId: user.id, workspace })).operations).toHaveLength(1)
  })

  it('persists mission runs, checkpoints, scheduler events, and checkpoint idempotency state defensively', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()
    const mission = createMission({ id: 'mission-001', ownerUserId: 'user-001', teamId: 'team-001' })
    const checkpoint = {
      id: 'checkpoint-001',
      missionRunId: mission.id,
      ordinal: 1,
      dueAt: '2026-05-05T18:00:00.000Z',
      completedAt: '2026-05-05T18:30:00.000Z',
      title: 'Checkpoint 6h',
      summary: 'Contradiction map complete.',
      artifactIds: ['artifact:contradiction-map'],
      vdiDelta: 4,
      status: 'completed' as const,
    }
    const event: MissionSchedulerEvent = {
      id: 'event-001',
      missionRunId: mission.id,
      checkpointId: checkpoint.id,
      type: 'checkpoint_completed',
      createdAt,
      payload: { token: 'kept-internal' },
    }

    await adapter.missions.saveMissionRun(mission)
    await adapter.missions.saveMissionCheckpoint(checkpoint)
    await adapter.missions.appendMissionSchedulerEvent(event)
    await adapter.missions.recordExecutedCheckpoint('mission-001:checkpoint-001')

    const saved = await adapter.missions.getMissionRun(mission.id)
    saved!.title = 'mutated locally'

    expect((await adapter.missions.getMissionRun(mission.id))!.title).toBe(mission.title)
    expect(await adapter.missions.listMissionRunsForOwner({ userId: 'user-001' })).toHaveLength(1)
    expect(await adapter.missions.listMissionRunsForOwner({ userId: 'user-other' })).toEqual([])
    expect(await adapter.missions.listMissionCheckpoints(mission.id)).toEqual([checkpoint])
    expect(await adapter.missions.listMissionSchedulerEvents(mission.id)).toEqual([event])
    expect(await adapter.missions.hasExecutedCheckpoint('mission-001:checkpoint-001')).toBe(true)
  })

  it('enforces evidence-backed quest progress, progression ledger, and metric snapshots', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()

    await expect(adapter.questProgress.saveQuestProgress({
      id: 'quest-progress-bad',
      questId: 'quest-001',
      userId: 'user-001',
      status: 'completed',
      percent: 100,
      evidenceRefs: [],
      completedAt: createdAt,
    })).rejects.toThrow('Completed quests require artifact or validation gate evidence')

    const progress = await adapter.questProgress.saveQuestProgress({
      id: 'quest-progress-001',
      questId: 'quest-001',
      userId: 'user-001',
      teamId: 'team-001',
      status: 'completed',
      percent: 100,
      evidenceRefs: ['artifact:final-fix-plan'],
      completedAt: createdAt,
    })

    await expect(adapter.questProgress.appendProgressLedger({
      id: 'ledger-bad',
      userId: 'user-001',
      eventType: 'xp',
      amount: 50,
      currency: 'xp',
      reason: 'manual spoof',
      createdAt,
    })).rejects.toThrow('XP and unlock ledger events require artifact or validation gate evidence')

    const ledger = await adapter.questProgress.appendProgressLedger({
      id: 'ledger-001',
      userId: 'user-001',
      teamId: 'team-001',
      eventType: 'xp',
      amount: 120,
      currency: 'xp',
      reason: 'Accepted verified mission artifact',
      sourceArtifactId: 'artifact:final-fix-plan',
      createdAt,
    })

    const metric = await adapter.metrics.appendMetricSnapshot({
      id: 'metric-001',
      missionRunId: 'mission-001',
      userId: 'user-001',
      teamId: 'team-001',
      qualityScore: 82,
      executionReadiness: 78,
      verifiedDeliverableIndex: 86,
      costEfficiency: 1.7,
      openRiskScore: 22,
      noiseScore: 8,
      evidenceRefs: ['artifact:final-fix-plan', 'gate:security:passed'],
      createdAt,
    })

    expect(progress.status).toBe('completed')
    expect(ledger.sourceArtifactId).toBe('artifact:final-fix-plan')
    expect(metric.verifiedDeliverableIndex).toBe(86)
    expect(await adapter.questProgress.listQuestProgressForUser('user-001')).toEqual([progress])
    expect(await adapter.questProgress.listProgressLedgerForTeam('team-001')).toEqual([ledger])
    expect(await adapter.metrics.listMetricSnapshotsForMission('mission-001')).toEqual([metric])
  })

  it('filters agent packages by built-in, private, team, and public visibility', async () => {
    const adapter = createInMemoryAgentWorkbenchPersistenceAdapter()

    await adapter.agentPackages.saveAgentPackage(createPackage({ id: 'pkg-built-in', visibility: 'built_in' }))
    await adapter.agentPackages.saveAgentPackage(createPackage({ id: 'pkg-public', visibility: 'public' }))
    await adapter.agentPackages.saveAgentPackage(createPackage({ id: 'pkg-private-owner', visibility: 'private', ownerUserId: 'user-001' }))
    await adapter.agentPackages.saveAgentPackage(createPackage({ id: 'pkg-private-other', visibility: 'private', ownerUserId: 'user-002' }))
    await adapter.agentPackages.saveAgentPackage(createPackage({ id: 'pkg-team-a', visibility: 'team', ownerTeamId: 'team-a' }))
    await adapter.agentPackages.saveAgentPackage(createPackage({ id: 'pkg-team-b', visibility: 'team', ownerTeamId: 'team-b' }))

    expect((await adapter.agentPackages.listVisibleAgentPackages({ userId: 'user-001', teamIds: ['team-a'] })).map(pkg => pkg.id)).toEqual([
      'pkg-built-in',
      'pkg-public',
      'pkg-private-owner',
      'pkg-team-a',
    ])
    expect((await adapter.agentPackages.listVisibleAgentPackages({ userId: 'user-003' })).map(pkg => pkg.id)).toEqual([
      'pkg-built-in',
      'pkg-public',
    ])
  })
})

function createMission(input: { id: string; ownerUserId: string; teamId?: string }): MissionRun {
  const requiredGateIds: MissionRun['requiredGateIds'] = ['schema', 'logic_check', 'fact_check']
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    ...(input.teamId ? { teamId: input.teamId } : {}),
    workspaceId: 'workspace-001',
    mode: 'deep_run' as const,
    experienceLayer: 'command' as const,
    title: '24h launch review',
    objective: 'Produce a verified blocker map and final fix plan.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status: 'running' as const,
    vdiTarget: 85,
    budgetCapCredits: 250,
    tokenCap: 1_000_000,
    storageCapBytes: 1_073_741_824,
    selectedAgentPackageIds: ['pkg-built-in'],
    requiredGateIds,
    createdAt,
    startedAt: createdAt,
  }
}

function createPackage(input: {
  id: string
  visibility: 'built_in' | 'private' | 'team' | 'public'
  ownerUserId?: string
  ownerTeamId?: string
}): AgentPackage {
  return {
    id: input.id,
    packageType: 'persona' as const,
    name: input.id,
    description: 'Deterministic package fixture.',
    ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
    ...(input.ownerTeamId ? { ownerTeamId: input.ownerTeamId } : {}),
    visibility: input.visibility,
    rarity: 'common' as const,
    trustScore: 80,
    riskLevel: 'low' as const,
    permissionProfileId: 'permission-read-review',
    latestVersion: '1.0.0',
    pricingModel: 'included',
    createdAt,
    updatedAt: createdAt,
  }
}
