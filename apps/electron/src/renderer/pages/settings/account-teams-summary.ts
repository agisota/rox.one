export type AccountTeamRole = 'owner' | 'admin' | 'member' | 'viewer' | string

export interface AccountTeam {
  id: string
  name: string
  slug: string
  role: AccountTeamRole
  status: string
  createdAt: string
  updatedAt?: string
}

export interface AccountTeamSpace {
  id: string
  organizationId: string
  name: string
  slug: string
  storagePrefix: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface AccountTeamsState {
  teams: AccountTeam[]
  spacesByTeamId: Record<string, AccountTeamSpace[]>
  error?: string | null
}

export interface AccountTeamSummaryRow {
  id: string
  label: string
  description: string
  canCreateInvite: boolean
  canCreateSpace: boolean
}

export interface AccountTeamsSummary {
  totalTeamsLabel: string
  totalSpacesLabel: string
  emptyLabel: string
  rows: AccountTeamSummaryRow[]
}

export function buildTeamSpacesPath(teamId: string): string {
  return `/api/account/teams/${encodeURIComponent(teamId)}/spaces`
}

export function buildCreateInvitePath(teamId: string): string {
  return `/api/account/teams/${encodeURIComponent(teamId)}/invites`
}

export function buildAcceptInvitePath(code: string): string {
  return `/api/account/invites/${encodeURIComponent(code)}/accept`
}

export function createEmptyAccountTeamsState(): AccountTeamsState {
  return {
    teams: [],
    spacesByTeamId: {},
    error: null,
  }
}

function canManageTeam(role: AccountTeamRole): boolean {
  return role === 'owner' || role === 'admin'
}

export function summarizeAccountTeams(state: AccountTeamsState): AccountTeamsSummary {
  if (state.error) {
    return {
      totalTeamsLabel: '0 команд',
      totalSpacesLabel: '0 spaces',
      emptyLabel: 'Команды не подключены',
      rows: [{
        id: 'teams-error',
        label: 'Команды временно недоступны',
        description: state.error,
        canCreateInvite: false,
        canCreateSpace: false,
      }],
    }
  }

  const totalSpaces = Object.values(state.spacesByTeamId).reduce((sum, spaces) => sum + spaces.length, 0)
  return {
    totalTeamsLabel: `${state.teams.length} ${state.teams.length === 1 ? 'команда' : 'команды'}`,
    totalSpacesLabel: `${totalSpaces} ${totalSpaces === 1 ? 'space' : 'spaces'}`,
    emptyLabel: 'Команды не подключены',
    rows: state.teams.map((team) => {
      const spaces = state.spacesByTeamId[team.id] ?? []
      const spaceLabel = spaces.length ? spaces.map((space) => space.name).join(', ') : 'нет'
      const canManage = canManageTeam(team.role)
      return {
        id: team.id,
        label: team.name,
        description: `${team.role} / ${team.status} / slug: ${team.slug} / spaces: ${spaceLabel}`,
        canCreateInvite: canManage,
        canCreateSpace: canManage,
      }
    }),
  }
}
