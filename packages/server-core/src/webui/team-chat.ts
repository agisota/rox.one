import { randomUUID } from 'node:crypto'
import type { AccountTeamRole } from './account-teams'

export type TeamMessageRefType =
  | 'workspace'
  | 'spec'
  | 'task'
  | 'artifact'
  | 'agent_run'
  | 'file'

export interface TeamMessageRef {
  type: TeamMessageRefType
  id: string
  title?: string
}

export interface TeamChatMessage {
  id: string
  teamId: string
  workspaceId: string | null
  authorUserId: string
  body: string
  refs: TeamMessageRef[]
  labels: string[]
  createdAt: string
}

export interface TeamChatPolicy {
  viewerCanWrite?: boolean
}

export interface AppendTeamMessageInput {
  actorUserId: string
  actorRole: AccountTeamRole
  teamId: string
  workspaceId?: string | null
  body: string
  refs?: TeamMessageRef[]
  labels?: string[]
  policy?: TeamChatPolicy
}

export interface ListTeamMessagesInput {
  actorRole: AccountTeamRole
  teamId: string
  workspaceId?: string
  limit?: number
}

export interface TeamChatStore {
  appendMessage(input: AppendTeamMessageInput): Promise<TeamChatMessage>
  listMessages(input: ListTeamMessagesInput): Promise<TeamChatMessage[]>
}

export class TeamChatForbiddenError extends Error {
  constructor(message = 'Team chat action is not allowed') {
    super(message)
    this.name = 'TeamChatForbiddenError'
  }
}

export class TeamChatValidationError extends Error {
  constructor(message = 'Team chat message is invalid') {
    super(message)
    this.name = 'TeamChatValidationError'
  }
}

const MAX_BODY_LENGTH = 20_000
const MAX_REFS = 50
const MAX_LABELS = 20
const REF_TYPES = new Set<TeamMessageRefType>([
  'workspace',
  'spec',
  'task',
  'artifact',
  'agent_run',
  'file',
])

export function canReadTeamMessages(role: AccountTeamRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer'
}

export function canWriteTeamMessages(role: AccountTeamRole, policy: TeamChatPolicy = {}): boolean {
  return role === 'owner'
    || role === 'admin'
    || role === 'member'
    || (role === 'viewer' && policy.viewerCanWrite === true)
}

function normalizeRequiredId(value: string, field: string): string {
  const normalized = value.trim()
  if (!normalized) throw new TeamChatValidationError(`${field} is required`)
  return normalized
}

function normalizeBody(body: string): string {
  const normalized = body.trim().replace(/\s+\n/g, '\n')
  if (!normalized) throw new TeamChatValidationError('Message body is required')
  if (normalized.length > MAX_BODY_LENGTH) throw new TeamChatValidationError('Message body is too long')
  return normalized
}

function normalizeRefs(refs: TeamMessageRef[] | undefined): TeamMessageRef[] {
  if (!refs) return []
  if (refs.length > MAX_REFS) throw new TeamChatValidationError('Too many message references')

  return refs.map(ref => {
    if (!ref || typeof ref !== 'object') throw new TeamChatValidationError('Message reference is invalid')
    if (!REF_TYPES.has(ref.type)) throw new TeamChatValidationError('Message reference type is invalid')
    if (typeof ref.id !== 'string') throw new TeamChatValidationError('Message reference id is invalid')
    const id = normalizeRequiredId(ref.id, 'Message reference id')
    if (ref.title != null && typeof ref.title !== 'string') throw new TeamChatValidationError('Message reference title is invalid')
    const title = ref.title?.trim()
    return title ? { type: ref.type, id, title } : { type: ref.type, id }
  })
}

function normalizeLabels(labels: string[] | undefined): string[] {
  if (!labels) return []
  if (labels.length > MAX_LABELS) throw new TeamChatValidationError('Too many message labels')

  const normalized: string[] = []
  const seen = new Set<string>()
  for (const label of labels) {
    if (typeof label !== 'string') throw new TeamChatValidationError('Message label is invalid')
    const value = label.trim().toLowerCase().replace(/\s+/g, '-')
    if (!value) throw new TeamChatValidationError('Message label is invalid')
    if (seen.has(value)) continue
    seen.add(value)
    normalized.push(value)
  }
  return normalized
}

function copyMessage(message: TeamChatMessage): TeamChatMessage {
  return {
    ...message,
    refs: message.refs.map(ref => ({ ...ref })),
    labels: [...message.labels],
  }
}

export class InMemoryTeamChatStore implements TeamChatStore {
  private readonly messagesByTeamId = new Map<string, TeamChatMessage[]>()

  async appendMessage(input: AppendTeamMessageInput): Promise<TeamChatMessage> {
    if (!canWriteTeamMessages(input.actorRole, input.policy)) {
      throw new TeamChatForbiddenError()
    }

    const teamId = normalizeRequiredId(input.teamId, 'Team id')
    const authorUserId = normalizeRequiredId(input.actorUserId, 'Author user id')
    const workspaceId = input.workspaceId == null
      ? null
      : normalizeRequiredId(input.workspaceId, 'Workspace id')

    const message: TeamChatMessage = {
      id: randomUUID(),
      teamId,
      workspaceId,
      authorUserId,
      body: normalizeBody(input.body),
      refs: normalizeRefs(input.refs),
      labels: normalizeLabels(input.labels),
      createdAt: new Date().toISOString(),
    }

    const messages = this.messagesByTeamId.get(teamId) ?? []
    messages.push(message)
    this.messagesByTeamId.set(teamId, messages)
    return copyMessage(message)
  }

  async listMessages(input: ListTeamMessagesInput): Promise<TeamChatMessage[]> {
    if (!canReadTeamMessages(input.actorRole)) {
      throw new TeamChatForbiddenError()
    }

    const teamId = normalizeRequiredId(input.teamId, 'Team id')
    const workspaceId = input.workspaceId?.trim()
    const limit = Number.isSafeInteger(input.limit) && input.limit! > 0 ? input.limit! : 100

    return (this.messagesByTeamId.get(teamId) ?? [])
      .filter(message => !workspaceId || message.workspaceId === workspaceId)
      .slice(-limit)
      .map(copyMessage)
  }
}
