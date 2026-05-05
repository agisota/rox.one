import { describe, expect, it } from 'bun:test';

import type {
  AgentPackage,
  MissionRun,
  ProgressLedger,
  SkillContract,
  SubscriptionEntitlement,
} from '../experience-layer';
import {
  assertEntitlementCannotSatisfyGate,
  assertLedgerEntryActor,
  assertMissionAccess,
  assertPackagePermissionProfile,
  assertPackageVisibilityAccess,
  assertPublicPackagePublishable,
  type ExperienceLayerActor,
} from '../experience-layer-security';

describe('experience layer security guards', () => {
  it('denies cross-team mission access', () => {
    const actor = createActor({ teamIds: ['team-alpha'] });
    const mission = createMission({ teamId: 'team-beta' });

    expect(() => assertMissionAccess({ actor, mission })).toThrow('Actor cannot access mission across tenant boundary.');
  });

  it('denies cross-team private and team package access', () => {
    const actor = createActor({ teamIds: ['team-beta'] });
    const pkg = createPackage({ visibility: 'team', ownerTeamId: 'team-alpha' });

    expect(() => assertPackageVisibilityAccess({ actor, package: pkg })).toThrow(
      'Actor cannot access package across tenant boundary.',
    );
  });

  it('denies ledger spoofing across user and team boundaries', () => {
    const actor = createActor({ userId: 'user-one', teamIds: ['team-alpha'] });

    expect(() =>
      assertLedgerEntryActor({
        actor,
        entry: createLedgerEntry({ userId: 'user-two', teamId: 'team-alpha' }),
      }),
    ).toThrow('Actor cannot write ledger entry for another user.');
    expect(() =>
      assertLedgerEntryActor({
        actor,
        entry: createLedgerEntry({ userId: 'user-one', teamId: 'team-beta' }),
      }),
    ).toThrow('Actor cannot write ledger entry for another team.');
  });

  it('denies paid entitlement validation gate bypass', () => {
    const entitlement = createEntitlement({ userId: 'user-one' });

    expect(() => assertEntitlementCannotSatisfyGate({ entitlement, gateId: 'fact_check' })).toThrow(
      'Paid entitlements cannot satisfy validation gates.',
    );
  });

  it('denies package permission escalation outside an allowed profile', () => {
    const contract = createContract({ requiredPermissions: ['read_artifacts', 'browser.write'] });

    expect(() =>
      assertPackagePermissionProfile({
        contract,
        allowedPermissions: ['read_artifacts'],
      }),
    ).toThrow('Package contract requests permissions outside the allowed profile: browser.write.');
  });

  it('blocks public package publish when prompt injection warnings remain', () => {
    expect(() =>
      assertPublicPackagePublishable({
        promptInjectionWarnings: ['ignore previous instructions'],
        hasContract: true,
        reviewCount: 2,
        passingTestCount: 4,
        trustScore: 80,
      }),
    ).toThrow('Prompt injection warnings block public package publish.');
  });

  it('requires contract, review, test, and trust evidence before public package publish', () => {
    expect(() =>
      assertPublicPackagePublishable(
        { promptInjectionWarnings: [] } as unknown as Parameters<typeof assertPublicPackagePublishable>[0],
      ),
    ).toThrow('Public package publish requires a skill contract.');

    expect(() =>
      assertPublicPackagePublishable({
        promptInjectionWarnings: [],
        hasContract: false,
        reviewCount: 2,
        passingTestCount: 4,
        trustScore: 80,
      }),
    ).toThrow('Public package publish requires a skill contract.');

    expect(() =>
      assertPublicPackagePublishable({
        promptInjectionWarnings: [],
        hasContract: true,
        reviewCount: 0,
        passingTestCount: 4,
        trustScore: 80,
      }),
    ).toThrow('Public package publish requires reviewer evidence.');

    expect(() =>
      assertPublicPackagePublishable({
        promptInjectionWarnings: [],
        hasContract: true,
        reviewCount: 2,
        passingTestCount: 0,
        trustScore: 80,
      }),
    ).toThrow('Public package publish requires passing test evidence.');

    expect(() =>
      assertPublicPackagePublishable({
        promptInjectionWarnings: [],
        hasContract: true,
        reviewCount: 2,
        passingTestCount: 4,
        trustScore: 49,
        minimumTrustScore: 50,
      }),
    ).toThrow('Public package publish requires trust score >= 50.');

    expect(
      assertPublicPackagePublishable({
        promptInjectionWarnings: [],
        hasContract: true,
        reviewCount: 2,
        passingTestCount: 4,
        trustScore: 80,
        minimumTrustScore: 50,
      }),
    ).toBe(true);
  });
});

function createActor(patch: Partial<ExperienceLayerActor> = {}): ExperienceLayerActor {
  return {
    userId: 'user-one',
    teamIds: ['team-alpha'],
    ...patch,
  };
}

function createMission(patch: Partial<MissionRun> = {}): MissionRun {
  return {
    id: 'mission-1',
    ownerUserId: 'user-one',
    teamId: 'team-alpha',
    workspaceId: 'workspace-main',
    mode: 'deep_run',
    experienceLayer: 'command',
    title: 'Security mission',
    objective: 'Verify tenant guard.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status: 'running',
    vdiTarget: 80,
    budgetCapCredits: 100,
    tokenCap: 100_000,
    storageCapBytes: 1_073_741_824,
    selectedAgentPackageIds: ['pkg-team-critic'],
    requiredGateIds: ['schema', 'security_check'],
    createdAt: '2026-04-30T00:00:00.000Z',
    startedAt: '2026-04-30T00:00:00.000Z',
    ...patch,
  };
}

function createPackage(patch: Partial<AgentPackage> = {}): AgentPackage {
  return {
    id: 'pkg-team-critic',
    packageType: 'persona',
    name: 'Team Critic',
    description: 'Private team reviewer.',
    ownerTeamId: 'team-alpha',
    visibility: 'team',
    rarity: 'rare',
    trustScore: 80,
    riskLevel: 'medium',
    permissionProfileId: 'permission-team-critic',
    latestVersion: '1.0.0',
    pricingModel: 'team_private',
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z',
    ...patch,
  };
}

function createLedgerEntry(patch: Partial<ProgressLedger> = {}): ProgressLedger {
  return {
    id: 'ledger-1',
    userId: 'user-one',
    teamId: 'team-alpha',
    eventType: 'xp',
    amount: 10,
    currency: 'xp',
    reason: 'Accepted finding.',
    sourceArtifactId: 'artifact:finding-1',
    createdAt: '2026-04-30T00:00:00.000Z',
    ...patch,
  };
}

function createEntitlement(patch: Partial<SubscriptionEntitlement> = {}): SubscriptionEntitlement {
  return {
    id: 'entitlement-pro',
    userId: 'user-one',
    planId: 'pro',
    swarmSlots: 100,
    maxMissionHours: 72,
    storageQuotaBytes: 100_000_000_000,
    privateAgentLimit: 50,
    publicMarketplaceAccess: true,
    createdAt: '2026-04-30T00:00:00.000Z',
    ...patch,
  };
}

function createContract(patch: Partial<SkillContract> = {}): SkillContract {
  return {
    id: 'contract-team-critic',
    packageId: 'pkg-team-critic',
    inputSchema: { task: 'string' },
    outputSchema: { findings: 'array' },
    examples: [{ input: { task: 'Review' }, output: { findings: [] } }],
    requiredTools: ['workspace.read'],
    requiredPermissions: ['read_artifacts'],
    requiredValidationGates: ['schema', 'logic_check'],
    failureModes: ['missing_evidence'],
    testFixtures: ['fixture:review'],
    ...patch,
  };
}
