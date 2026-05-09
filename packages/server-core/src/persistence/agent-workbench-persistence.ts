import { randomUUID } from 'node:crypto'

import {
  AgentPackageSchema,
  MetricSnapshotSchema,
  MissionCheckpointSchema,
  MissionRunSchema,
  ProgressLedgerSchema,
  QuestProgressSchema,
  type AgentPackage,
  type AgentPackageVisibility,
  type MetricSnapshot,
  type MissionCheckpoint,
  type MissionRun,
  type ProgressLedger,
  type QuestProgress,
} from '@rox-agent/shared/workbench'

import {
  AccountAuthError,
  AccountConflictError,
  type AccountSession,
  type AccountStore,
  type CreateAccountSessionInput,
  type CreateEmailTokenInput,
  type CreateUserInput,
  type EmailTokenPurpose,
  type PublicUser,
  type RevokeSessionResult,
  type SessionIdentity,
} from '../accounts'
import { InMemoryObjectStorageAdapter, QuotaObjectStorageService, type ObjectStorageAdapter } from '../storage/object-storage'
import { InMemorySyncFileStore, type SyncFileStore } from '../sync/local-cloud-sync'
import { InMemoryWorkspaceSyncService, type WorkspaceSyncService } from '../sync/workspace-sync-service'
import { InMemoryDvnetBillingIntentStore, type DvnetBillingIntentStore } from '../webui/account-billing'
import { InMemoryManagedCloudWorkspaceStore, type ManagedCloudWorkspaceStore } from '../webui/account-cloud-workspaces'
import { InMemoryAccountEventHistory, type AccountEventHistory } from '../webui/account-events'
import { InMemoryAccountUsageLedger, type AccountUsageLedger } from '../webui/account-ledger'
import { InMemoryAccountTeamStore, type AccountTeamStore } from '../webui/account-teams'
import { InMemoryTeamChatStore, type TeamChatStore } from '../webui/team-chat'

export interface MissionSchedulerEvent {
  id: string
  missionRunId: string
  checkpointId?: string
  type: string
  createdAt: string
  payload: Record<string, unknown>
}

export interface MissionRunOwnerFilter {
  userId: string
  teamId?: string
  workspaceId?: string
}

export interface MissionRunRepository {
  saveMissionRun(mission: MissionRun): Promise<MissionRun>
  getMissionRun(id: string): Promise<MissionRun | null>
  listMissionRunsForOwner(filter: MissionRunOwnerFilter): Promise<MissionRun[]>
  saveMissionCheckpoint(checkpoint: MissionCheckpoint): Promise<MissionCheckpoint>
  listMissionCheckpoints(missionRunId: string): Promise<MissionCheckpoint[]>
  appendMissionSchedulerEvent(event: MissionSchedulerEvent): Promise<MissionSchedulerEvent>
  listMissionSchedulerEvents(missionRunId: string): Promise<MissionSchedulerEvent[]>
  recordExecutedCheckpoint(idempotencyKey: string): Promise<void>
  hasExecutedCheckpoint(idempotencyKey: string): Promise<boolean>
}

export interface QuestProgressRepository {
  saveQuestProgress(progress: QuestProgress): Promise<QuestProgress>
  getQuestProgress(id: string): Promise<QuestProgress | null>
  listQuestProgressForUser(userId: string): Promise<QuestProgress[]>
  listQuestProgressForTeam(teamId: string): Promise<QuestProgress[]>
  appendProgressLedger(entry: ProgressLedger): Promise<ProgressLedger>
  listProgressLedgerForUser(userId: string): Promise<ProgressLedger[]>
  listProgressLedgerForTeam(teamId: string): Promise<ProgressLedger[]>
}

export interface MetricSnapshotRepository {
  appendMetricSnapshot(snapshot: MetricSnapshot): Promise<MetricSnapshot>
  listMetricSnapshotsForMission(missionRunId: string): Promise<MetricSnapshot[]>
  listMetricSnapshotsForUser(userId: string): Promise<MetricSnapshot[]>
  listMetricSnapshotsForTeam(teamId: string): Promise<MetricSnapshot[]>
}

export interface AgentPackageVisibilityFilter {
  userId: string
  teamIds?: string[]
}

export interface AgentPackageRepository {
  saveAgentPackage(agentPackage: AgentPackage): Promise<AgentPackage>
  getAgentPackage(id: string): Promise<AgentPackage | null>
  listVisibleAgentPackages(filter: AgentPackageVisibilityFilter): Promise<AgentPackage[]>
}

export interface AgentWorkbenchPersistenceAdapter {
  accounts: AccountStore
  teams: AccountTeamStore
  ledger: AccountUsageLedger
  audit: AccountEventHistory
  cloudWorkspaces: ManagedCloudWorkspaceStore
  teamChat: TeamChatStore
  billingIntents: DvnetBillingIntentStore
  objectStorage: ObjectStorageAdapter
  storage: QuotaObjectStorageService
  syncFiles: SyncFileStore
  workspaceSync: WorkspaceSyncService
  missions: MissionRunRepository
  questProgress: QuestProgressRepository
  metrics: MetricSnapshotRepository
  agentPackages: AgentPackageRepository
}

export interface CreateInMemoryAgentWorkbenchPersistenceAdapterOptions {
  bucket?: string
  accounts?: AccountStore
  teams?: AccountTeamStore
  ledger?: AccountUsageLedger
  audit?: AccountEventHistory
  cloudWorkspaces?: ManagedCloudWorkspaceStore
  teamChat?: TeamChatStore
  billingIntents?: DvnetBillingIntentStore
  objectStorage?: ObjectStorageAdapter
  syncFiles?: SyncFileStore
  workspaceSync?: WorkspaceSyncService
  missions?: MissionRunRepository
  questProgress?: QuestProgressRepository
  metrics?: MetricSnapshotRepository
  agentPackages?: AgentPackageRepository
}

export class InMemoryAccountStore implements AccountStore {
  private readonly users = new Map<string, PublicUser & { passwordHash: string }>()
  private readonly sessions = new Map<string, AccountSession>()
  private readonly tokens = new Map<string, { userId: string; purpose: EmailTokenPurpose; expiresAt: string; consumedAt: string | null }>()
  private readonly workspaceIdsByUserId = new Map<string, Set<string>>()

  async migrate(): Promise<void> {}

  async getUserCount(): Promise<number> {
    return this.users.size
  }

  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const email = normalizeEmail(input.email)
    if ([...this.users.values()].some(user => user.email === email)) {
      throw new AccountConflictError()
    }

    const now = new Date().toISOString()
    const user = {
      id: randomUUID(),
      email,
      displayName: input.displayName?.trim() || null,
      role: 'user' as const,
      status: 'pending_email_verification' as const,
      emailVerifiedAt: null,
      createdAt: now,
      updatedAt: now,
      passwordHash: await Bun.password.hash(input.password, { algorithm: 'argon2id' }),
    }
    this.users.set(user.id, user)
    return copyPublicUser(user)
  }

  async getUserByEmail(email: string): Promise<PublicUser | null> {
    const user = this.findUserByEmail(email)
    return user ? copyPublicUser(user) : null
  }

  async verifyPassword(email: string, password: string): Promise<PublicUser | null> {
    const user = this.findUserByEmail(email)
    if (!user || !await Bun.password.verify(password, user.passwordHash)) return null
    return copyPublicUser(user)
  }

  async createSession(input: CreateAccountSessionInput): Promise<AccountSession> {
    const session: AccountSession = {
      id: randomUUID(),
      userId: input.userId,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      authMethod: input.authMethod ?? 'password',
      createdAt: new Date().toISOString(),
      expiresAt: (input.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
      revokedAt: null,
    }
    this.sessions.set(session.id, session)
    return copyJson(session)
  }

  async getSessionIdentity(sessionId: string): Promise<SessionIdentity | null> {
    const session = this.sessions.get(sessionId)
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) return null

    const user = this.users.get(session.userId)
    if (!user) return null

    return {
      userId: user.id,
      sessionId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    }
  }

  async listSessions(userId: string): Promise<AccountSession[]> {
    return [...this.sessions.values()]
      .filter(session =>
        session.userId === userId
        && !session.revokedAt
        && new Date(session.expiresAt).getTime() > Date.now(),
      )
      .map(copyJson)
  }

  async revokeSession(sessionId: string): Promise<RevokeSessionResult> {
    const session = this.sessions.get(sessionId)
    if (!session) return { revoked: false, sessionId: null }
    if (session.revokedAt) return { revoked: false, sessionId }
    // The Map mutation below is the in-memory equivalent of the SQL
    // compare-and-swap in PostgresAccountStore.revokeSession: only the call
    // that flips revokedAt from null to a timestamp returns `revoked: true`.
    // Bun runs JS handlers single-threaded, so the read-then-write is atomic
    // with respect to other store callers in the same process.
    this.sessions.set(sessionId, { ...session, revokedAt: new Date().toISOString() })
    return { revoked: true, sessionId }
  }

  async revokeUserSessions(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        this.sessions.set(session.id, { ...session, revokedAt: new Date().toISOString() })
      }
    }
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.id !== currentSessionId && !session.revokedAt) {
        this.sessions.set(session.id, { ...session, revokedAt: new Date().toISOString() })
      }
    }
  }

  async getUser(userId: string): Promise<PublicUser | null> {
    const user = this.users.get(userId)
    return user ? copyPublicUser(user) : null
  }

  async updateUser(userId: string, patch: { displayName?: string | null }): Promise<PublicUser> {
    const user = this.getInternalUser(userId)
    const next = {
      ...user,
      displayName: patch.displayName ?? null,
      updatedAt: new Date().toISOString(),
    }
    this.users.set(userId, next)
    return copyPublicUser(next)
  }

  async markEmailVerified(userId: string): Promise<PublicUser> {
    const user = this.getInternalUser(userId)
    const next = {
      ...user,
      status: 'active' as const,
      emailVerifiedAt: user.emailVerifiedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.users.set(userId, next)
    return copyPublicUser(next)
  }

  async createEmailToken(input: CreateEmailTokenInput): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = randomUUID()
    const expiresAt = (input.expiresAt ?? new Date(Date.now() + 86_400_000)).toISOString()
    this.tokens.set(rawToken, {
      userId: input.userId,
      purpose: input.purpose,
      expiresAt,
      consumedAt: null,
    })
    return { rawToken, expiresAt }
  }

  async consumeEmailToken(purpose: EmailTokenPurpose, rawToken: string): Promise<PublicUser | null> {
    const token = this.tokens.get(rawToken)
    if (!token || token.purpose !== purpose || token.consumedAt || new Date(token.expiresAt).getTime() <= Date.now()) {
      return null
    }
    this.tokens.set(rawToken, { ...token, consumedAt: new Date().toISOString() })
    return this.getUser(token.userId)
  }

  async setPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.getInternalUser(userId)
    this.users.set(userId, {
      ...user,
      passwordHash: await Bun.password.hash(newPassword, { algorithm: 'argon2id' }),
      updatedAt: new Date().toISOString(),
    })
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.getInternalUser(userId)
    if (!await Bun.password.verify(currentPassword, user.passwordHash)) {
      throw new AccountAuthError()
    }
    await this.setPassword(userId, newPassword)
  }

  async grantWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
    const workspaceIds = this.workspaceIdsByUserId.get(userId) ?? new Set<string>()
    workspaceIds.add(workspaceId)
    this.workspaceIdsByUserId.set(userId, workspaceIds)
  }

  async isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
    return this.workspaceIdsByUserId.get(userId)?.has(workspaceId) ?? false
  }

  async listWorkspaceIds(userId: string): Promise<string[]> {
    return [...(this.workspaceIdsByUserId.get(userId) ?? [])].sort()
  }

  private findUserByEmail(email: string): PublicUser & { passwordHash: string } | undefined {
    const normalized = normalizeEmail(email)
    return [...this.users.values()].find(user => user.email === normalized)
  }

  private getInternalUser(userId: string): PublicUser & { passwordHash: string } {
    const user = this.users.get(userId)
    if (!user) throw new Error('User not found')
    return user
  }
}

export class InMemoryMissionRunRepository implements MissionRunRepository {
  private readonly missions = new Map<string, MissionRun>()
  private readonly checkpointsByMissionId = new Map<string, MissionCheckpoint[]>()
  private readonly eventsByMissionId = new Map<string, MissionSchedulerEvent[]>()
  private readonly executedCheckpointKeys = new Set<string>()

  async saveMissionRun(mission: MissionRun): Promise<MissionRun> {
    const parsed = MissionRunSchema.parse(mission)
    this.missions.set(parsed.id, copyJson(parsed))
    return copyJson(parsed)
  }

  async getMissionRun(id: string): Promise<MissionRun | null> {
    const mission = this.missions.get(id)
    return mission ? copyJson(mission) : null
  }

  async listMissionRunsForOwner(filter: MissionRunOwnerFilter): Promise<MissionRun[]> {
    return [...this.missions.values()]
      .filter(mission => mission.ownerUserId === filter.userId || Boolean(filter.teamId && mission.teamId === filter.teamId))
      .filter(mission => !filter.workspaceId || mission.workspaceId === filter.workspaceId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map(copyJson)
  }

  async saveMissionCheckpoint(checkpoint: MissionCheckpoint): Promise<MissionCheckpoint> {
    const parsed = MissionCheckpointSchema.parse(checkpoint)
    const checkpoints = this.checkpointsByMissionId.get(parsed.missionRunId) ?? []
    const next = checkpoints.filter(candidate => candidate.id !== parsed.id)
    next.push(copyJson(parsed))
    next.sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id))
    this.checkpointsByMissionId.set(parsed.missionRunId, next)
    return copyJson(parsed)
  }

  async listMissionCheckpoints(missionRunId: string): Promise<MissionCheckpoint[]> {
    return (this.checkpointsByMissionId.get(missionRunId) ?? []).map(copyJson)
  }

  async appendMissionSchedulerEvent(event: MissionSchedulerEvent): Promise<MissionSchedulerEvent> {
    const parsed = parseMissionSchedulerEvent(event)
    const events = this.eventsByMissionId.get(parsed.missionRunId) ?? []
    events.push(copyJson(parsed))
    this.eventsByMissionId.set(parsed.missionRunId, events)
    return copyJson(parsed)
  }

  async listMissionSchedulerEvents(missionRunId: string): Promise<MissionSchedulerEvent[]> {
    return (this.eventsByMissionId.get(missionRunId) ?? []).map(copyJson)
  }

  async recordExecutedCheckpoint(idempotencyKey: string): Promise<void> {
    const key = idempotencyKey.trim()
    if (!key) throw new Error('Checkpoint idempotency key is required')
    this.executedCheckpointKeys.add(key)
  }

  async hasExecutedCheckpoint(idempotencyKey: string): Promise<boolean> {
    return this.executedCheckpointKeys.has(idempotencyKey.trim())
  }
}

export class InMemoryQuestProgressRepository implements QuestProgressRepository {
  private readonly progressById = new Map<string, QuestProgress>()
  private readonly ledgerEntries: ProgressLedger[] = []

  async saveQuestProgress(progress: QuestProgress): Promise<QuestProgress> {
    const parsed = QuestProgressSchema.parse(progress)
    this.progressById.set(parsed.id, copyJson(parsed))
    return copyJson(parsed)
  }

  async getQuestProgress(id: string): Promise<QuestProgress | null> {
    const progress = this.progressById.get(id)
    return progress ? copyJson(progress) : null
  }

  async listQuestProgressForUser(userId: string): Promise<QuestProgress[]> {
    return [...this.progressById.values()]
      .filter(progress => progress.userId === userId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(copyJson)
  }

  async listQuestProgressForTeam(teamId: string): Promise<QuestProgress[]> {
    return [...this.progressById.values()]
      .filter(progress => progress.teamId === teamId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(copyJson)
  }

  async appendProgressLedger(entry: ProgressLedger): Promise<ProgressLedger> {
    const parsed = ProgressLedgerSchema.parse(entry)
    this.ledgerEntries.push(copyJson(parsed))
    return copyJson(parsed)
  }

  async listProgressLedgerForUser(userId: string): Promise<ProgressLedger[]> {
    return this.ledgerEntries
      .filter(entry => entry.userId === userId)
      .sort(compareCreatedAtThenId)
      .map(copyJson)
  }

  async listProgressLedgerForTeam(teamId: string): Promise<ProgressLedger[]> {
    return this.ledgerEntries
      .filter(entry => entry.teamId === teamId)
      .sort(compareCreatedAtThenId)
      .map(copyJson)
  }
}

export class InMemoryMetricSnapshotRepository implements MetricSnapshotRepository {
  private readonly snapshots: MetricSnapshot[] = []

  async appendMetricSnapshot(snapshot: MetricSnapshot): Promise<MetricSnapshot> {
    const parsed = MetricSnapshotSchema.parse(snapshot)
    this.snapshots.push(copyJson(parsed))
    return copyJson(parsed)
  }

  async listMetricSnapshotsForMission(missionRunId: string): Promise<MetricSnapshot[]> {
    return this.snapshots
      .filter(snapshot => snapshot.missionRunId === missionRunId)
      .sort(compareCreatedAtThenId)
      .map(copyJson)
  }

  async listMetricSnapshotsForUser(userId: string): Promise<MetricSnapshot[]> {
    return this.snapshots
      .filter(snapshot => snapshot.userId === userId)
      .sort(compareCreatedAtThenId)
      .map(copyJson)
  }

  async listMetricSnapshotsForTeam(teamId: string): Promise<MetricSnapshot[]> {
    return this.snapshots
      .filter(snapshot => snapshot.teamId === teamId)
      .sort(compareCreatedAtThenId)
      .map(copyJson)
  }
}

export class InMemoryAgentPackageRepository implements AgentPackageRepository {
  private readonly packagesById = new Map<string, AgentPackage>()

  async saveAgentPackage(agentPackage: AgentPackage): Promise<AgentPackage> {
    const parsed = AgentPackageSchema.parse(agentPackage)
    validatePackageOwnership(parsed)
    this.packagesById.set(parsed.id, copyJson(parsed))
    return copyJson(parsed)
  }

  async getAgentPackage(id: string): Promise<AgentPackage | null> {
    const agentPackage = this.packagesById.get(id)
    return agentPackage ? copyJson(agentPackage) : null
  }

  async listVisibleAgentPackages(filter: AgentPackageVisibilityFilter): Promise<AgentPackage[]> {
    const teamIds = new Set(filter.teamIds ?? [])
    return [...this.packagesById.values()]
      .filter(agentPackage => isPackageVisibleTo(agentPackage, filter.userId, teamIds))
      .sort((left, right) => visibilityRank(left.visibility) - visibilityRank(right.visibility) || left.id.localeCompare(right.id))
      .map(copyJson)
  }
}

export function createInMemoryAgentWorkbenchPersistenceAdapter(
  options: CreateInMemoryAgentWorkbenchPersistenceAdapterOptions = {},
): AgentWorkbenchPersistenceAdapter {
  const objectStorage = options.objectStorage ?? new InMemoryObjectStorageAdapter()
  return {
    accounts: options.accounts ?? new InMemoryAccountStore(),
    teams: options.teams ?? new InMemoryAccountTeamStore(),
    ledger: options.ledger ?? new InMemoryAccountUsageLedger(),
    audit: options.audit ?? new InMemoryAccountEventHistory(),
    cloudWorkspaces: options.cloudWorkspaces ?? new InMemoryManagedCloudWorkspaceStore(),
    teamChat: options.teamChat ?? new InMemoryTeamChatStore(),
    billingIntents: options.billingIntents ?? new InMemoryDvnetBillingIntentStore(),
    objectStorage,
    storage: new QuotaObjectStorageService({
      adapter: objectStorage,
      bucket: options.bucket ?? 'agent-artifacts',
    }),
    syncFiles: options.syncFiles ?? new InMemorySyncFileStore(),
    workspaceSync: options.workspaceSync ?? new InMemoryWorkspaceSyncService(),
    missions: options.missions ?? new InMemoryMissionRunRepository(),
    questProgress: options.questProgress ?? new InMemoryQuestProgressRepository(),
    metrics: options.metrics ?? new InMemoryMetricSnapshotRepository(),
    agentPackages: options.agentPackages ?? new InMemoryAgentPackageRepository(),
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!normalized) throw new Error('Email is required')
  return normalized
}

function copyPublicUser(user: PublicUser & { passwordHash?: string }): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user
  return copyJson(publicUser)
}

function parseMissionSchedulerEvent(event: MissionSchedulerEvent): MissionSchedulerEvent {
  if (!event.id.trim()) throw new Error('Mission scheduler event id is required')
  if (!event.missionRunId.trim()) throw new Error('Mission scheduler event missionRunId is required')
  if (!event.type.trim()) throw new Error('Mission scheduler event type is required')
  if (!event.createdAt.trim()) throw new Error('Mission scheduler event createdAt is required')
  return {
    id: event.id,
    missionRunId: event.missionRunId,
    ...(event.checkpointId ? { checkpointId: event.checkpointId } : {}),
    type: event.type,
    createdAt: event.createdAt,
    payload: copyJson(event.payload),
  }
}

function validatePackageOwnership(agentPackage: AgentPackage): void {
  if (agentPackage.visibility === 'private' && !agentPackage.ownerUserId) {
    throw new Error('Private agent packages require ownerUserId')
  }
  if (agentPackage.visibility === 'team' && !agentPackage.ownerTeamId) {
    throw new Error('Team agent packages require ownerTeamId')
  }
}

function isPackageVisibleTo(agentPackage: AgentPackage, userId: string, teamIds: Set<string>): boolean {
  if (agentPackage.visibility === 'built_in' || agentPackage.visibility === 'public') return true
  if (agentPackage.visibility === 'private') return agentPackage.ownerUserId === userId
  if (agentPackage.visibility === 'team') return Boolean(agentPackage.ownerTeamId && teamIds.has(agentPackage.ownerTeamId))
  return false
}

function visibilityRank(visibility: AgentPackageVisibility): number {
  return {
    built_in: 0,
    public: 1,
    private: 2,
    team: 3,
  }[visibility]
}

function compareCreatedAtThenId<T extends { createdAt: string; id: string }>(left: T, right: T): number {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
}

function copyJson<T>(value: T): T {
  return structuredClone(value)
}
