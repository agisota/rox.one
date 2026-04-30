import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const source = readFileSync(join(import.meta.dir, '..', 'rox-one-auth-server.mjs'), 'utf8');

describe('rox-one auth server account contract', () => {
  test('declares durable team spaces and invite tables', () => {
    expect(source).toContain('CREATE TABLE IF NOT EXISTS rox_team_spaces');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS rox_team_invites');
  });

  test('declares durable billing top-up and DV.net webhook tables', () => {
    expect(source).toContain('CREATE TABLE IF NOT EXISTS rox_billing_topups');
    expect(source).toContain('CREATE TABLE IF NOT EXISTS rox_dvnet_webhook_events');
    expect(source).toContain('UNIQUE(tx_hash, bc_uniq_key)');
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

  test('creates DV.net payment-form intents without exposing secrets', () => {
    expect(source).toContain('DVNET_PAYMENT_BASE_URL');
    expect(source).toContain('DVNET_STORE_UUID');
    expect(source).toContain("provider: 'dv.net'");
    expect(source).toContain("`/pay/store/${encodeURIComponent(DVNET_STORE_UUID)}/${encodeURIComponent(intent.id)}`");
    expect(source).toContain('createDvnetTopUpIntent(session.id)');
    expect(source).not.toContain('webhookSecret: DVNET_WEBHOOK_SECRET');
  });

  test('verifies DV.net webhooks by raw body, X-SIGN, and tx idempotency', () => {
    expect(source).toContain("url.pathname === '/api/webhooks/dvnet'");
    expect(source).toContain("req.headers['x-sign']");
    expect(source).toContain('verifyDvnetWebhookSignature(rawBody, signature)');
    expect(source).toContain("payload.type !== 'PaymentReceived'");
    expect(source).toContain("payload.status !== 'completed'");
    expect(source).toContain('recordDvnetWebhookEvent(txHash, bcUniqKey, intent, amountUnits)');
    expect(source).toContain('creditAccountBalance(intent.user_id, amountUnits');
    expect(source).toContain('return json(res, 200, { success: true })');
  });
});
