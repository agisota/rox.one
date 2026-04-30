import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const source = readFileSync(join(import.meta.dir, '..', 'rox-one-auth-server.mjs'), 'utf8');

describe('rox-one auth server account contract', () => {
  test('declares durable team spaces and invite tables', () => {
    expect(source).toContain('CREATE TABLE IF NOT EXISTS rox_team_spaces');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS rox_team_invites');
  });

  test('serves team-first aliases, spaces, invites, and storage cabinet endpoints', () => {
    expect(source).toContain("url.pathname === '/api/account/teams'");
    expect(source).toContain("url.pathname === '/api/account/storage'");
    expect(source).toContain("const teamSpacesMatch = url.pathname.match(/^\\/api\\/account\\/teams\\/([^/]+)\\/spaces$/)");
    expect(source).toContain("const teamInvitesMatch = url.pathname.match(/^\\/api\\/account\\/teams\\/([^/]+)\\/invites$/)");
    expect(source).toContain("const inviteAcceptMatch = url.pathname.match(/^\\/api\\/account\\/invites\\/([^/]+)\\/accept$/)");
  });

  test('keeps team joins invite based while preserving organization compatibility routes', () => {
    expect(source).toContain("url.pathname === '/api/account/organizations'");
    expect(source).toContain("url.pathname === '/api/account/organizations/join'");
    expect(source).toContain('joinOrganization(session.id, body.code || body.slug || body.organizationId)');
    expect(source).toContain('acceptTeamInvite(session.id, decodeURIComponent(inviteAcceptMatch[1]))');
  });
});
