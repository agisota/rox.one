import { describe, expect, test } from 'bun:test';
import {
  buildAcceptInvitePath,
  buildCreateInvitePath,
  buildTeamSpacesPath,
  createEmptyAccountTeamsState,
  summarizeAccountTeams,
  type AccountTeam,
  type AccountTeamSpace,
} from '../account-teams-summary';

describe('account teams summary', () => {
  test('maps team and invite actions to team-first account endpoints', () => {
    expect(buildTeamSpacesPath('team/alpha')).toBe('/api/account/teams/team%2Falpha/spaces');
    expect(buildCreateInvitePath('team/alpha')).toBe('/api/account/teams/team%2Falpha/invites');
    expect(buildAcceptInvitePath('invite code/1')).toBe('/api/account/invites/invite%20code%2F1/accept');
  });

  test('summarizes teams with spaces and owner/admin actions', () => {
    const teams: AccountTeam[] = [
      {
        id: 'team-a',
        name: 'ROX Ops',
        slug: 'rox-ops',
        role: 'owner',
        status: 'active',
        createdAt: '2026-04-30T10:00:00.000Z',
      },
      {
        id: 'team-b',
        name: 'Client View',
        slug: 'client-view',
        role: 'viewer',
        status: 'active',
        createdAt: '2026-04-30T11:00:00.000Z',
      },
    ];
    const spacesByTeamId: Record<string, AccountTeamSpace[]> = {
      'team-a': [
        {
          id: 'space-a',
          organizationId: 'team-a',
          name: 'Release Room',
          slug: 'release-room',
          storagePrefix: 'teams/team-a/spaces/space-a/',
          createdByUserId: 'user-a',
          createdAt: '2026-04-30T12:00:00.000Z',
          updatedAt: '2026-04-30T12:00:00.000Z',
        },
      ],
      'team-b': [],
    };

    const summary = summarizeAccountTeams({ teams, spacesByTeamId });

    expect(summary.totalTeamsLabel).toBe('2 команды');
    expect(summary.totalSpacesLabel).toBe('1 space');
    expect(summary.rows).toEqual([
      {
        id: 'team-a',
        label: 'ROX Ops',
        description: 'owner / active / slug: rox-ops / spaces: Release Room',
        canCreateInvite: true,
        canCreateSpace: true,
      },
      {
        id: 'team-b',
        label: 'Client View',
        description: 'viewer / active / slug: client-view / spaces: нет',
        canCreateInvite: false,
        canCreateSpace: false,
      },
    ]);
  });

  test('keeps empty and error states explicit', () => {
    expect(summarizeAccountTeams(createEmptyAccountTeamsState()).emptyLabel).toBe('Команды не подключены');
    expect(summarizeAccountTeams({
      teams: [],
      spacesByTeamId: {},
      error: 'Team spaces are not available',
    }).rows).toEqual([
      {
        id: 'teams-error',
        label: 'Команды временно недоступны',
        description: 'Team spaces are not available',
        canCreateInvite: false,
        canCreateSpace: false,
      },
    ]);
  });
});
