import { describe, expect, it } from 'bun:test';

import { ValidationGateSchema } from '../product-mode-registry';
import {
  AgentPackageSchema,
  ExperienceLayerSchema,
  ExperiencePreferenceSchema,
  MissionCheckpointSchema,
  MissionRunSchema,
  QuestProgressSchema,
  SkillContractSchema,
  SubscriptionEntitlementSchema,
  assertQuestCompletionEvidence,
  calculateAgentExperience,
  calculateSkillMastery,
  calculateVerifiedDeliverableIndex,
  createDefaultExperiencePreference,
  evaluateMissionCompletion,
  paidEntitlementCanSatisfyValidationGate,
  projectExperienceLayerView,
} from '../experience-layer';

const createdAt = '2026-04-30T12:00:00.000Z';

describe('Experience Layer core schemas', () => {
  it('validates the required core schema surface', () => {
    expect(ExperienceLayerSchema.options).toEqual(['command', 'game', 'arena']);
    expect(ValidationGateSchema.parse('schema')).toBe('schema');

    const preference = createDefaultExperiencePreference({
      id: 'experience-pref-001',
      userId: 'user-001',
      createdAt,
      updatedAt: createdAt,
    });

    expect(ExperiencePreferenceSchema.parse(preference).defaultLayer).toBe('command');
    expect(preference.allowedLayers).toEqual(['command', 'game', 'arena']);

    const mission = MissionRunSchema.parse({
      id: 'mission-001',
      ownerUserId: 'user-001',
      workspaceId: 'workspace-001',
      mode: 'deep_run',
      experienceLayer: 'arena',
      title: '24h launch review',
      objective: 'Find blockers and produce a verified fix plan.',
      durationHours: 24,
      checkpointCadenceHours: 6,
      status: 'draft',
      vdiTarget: 82,
      budgetCapCredits: 250,
      tokenCap: 1_000_000,
      storageCapBytes: 1_073_741_824,
      selectedAgentPackageIds: ['agent-package-001'],
      requiredGateIds: ['schema', 'logic_check', 'fact_check'],
      createdAt,
    });

    expect(mission.mode).toBe('deep_run');
    expect(mission.requiredGateIds).toContain('fact_check');

    expect(
      MissionCheckpointSchema.parse({
        id: 'checkpoint-001',
        missionRunId: mission.id,
        ordinal: 1,
        dueAt: '2026-04-30T18:00:00.000Z',
        title: 'First verdict',
        summary: 'Initial contradiction map and risks.',
        artifactIds: ['artifact-001'],
        vdiDelta: 7,
        status: 'completed',
      }).artifactIds,
    ).toEqual(['artifact-001']);

    expect(
      AgentPackageSchema.parse({
        id: 'agent-package-001',
        packageType: 'persona',
        name: 'Skeptic Operator',
        description: 'Stress-tests plans for operational blockers.',
        visibility: 'team',
        rarity: 'epic',
        trustScore: 88,
        riskLevel: 'medium',
        permissionProfileId: 'permission-read-review',
        latestVersion: '1.0.0',
        pricingModel: 'included',
        createdAt,
        updatedAt: createdAt,
      }).trustScore,
    ).toBe(88);

    expect(
      SkillContractSchema.parse({
        id: 'skill-contract-001',
        packageId: 'agent-package-001',
        inputSchema: { type: 'object', required: ['artifactId'] },
        outputSchema: { type: 'object', required: ['findings'] },
        examples: [{ input: { artifactId: 'artifact-001' }, output: { findings: [] } }],
        requiredTools: ['read_artifact'],
        requiredPermissions: ['workspace:read'],
        requiredValidationGates: ['schema', 'logic_check'],
        failureModes: ['unsupported_claims', 'missing_context'],
        testFixtures: ['fixture-review-001'],
      }).requiredValidationGates,
    ).toEqual(['schema', 'logic_check']);
  });

  it('rejects invalid scores, empty evidence claims, and invalid entitlement capacity', () => {
    expect(() =>
      AgentPackageSchema.parse({
        id: 'bad-agent',
        packageType: 'persona',
        name: 'Bad Agent',
        description: 'Invalid trust score.',
        visibility: 'public',
        rarity: 'legendary',
        trustScore: 101,
        riskLevel: 'high',
        permissionProfileId: 'permission-risky',
        latestVersion: '1.0.0',
        pricingModel: 'paid',
        createdAt,
        updatedAt: createdAt,
      }),
    ).toThrow();

    expect(() =>
      QuestProgressSchema.parse({
        id: 'quest-progress-001',
        questId: 'quest-001',
        userId: 'user-001',
        status: 'completed',
        percent: 100,
        evidenceRefs: [],
        completedAt: createdAt,
      }),
    ).toThrow();

    expect(() =>
      SubscriptionEntitlementSchema.parse({
        id: 'entitlement-001',
        userId: 'user-001',
        planId: 'bad-plan',
        swarmSlots: -1,
        maxMissionHours: 24,
        storageQuotaBytes: 1_073_741_824,
        privateAgentLimit: 10,
        publicMarketplaceAccess: false,
        createdAt,
      }),
    ).toThrow();
  });
});

describe('Experience Layer truth semantics', () => {
  it('projects Command, Game, and Arena views without changing shared mission truth', () => {
    const mission = MissionRunSchema.parse({
      id: 'mission-truth-001',
      ownerUserId: 'user-001',
      teamId: 'team-001',
      workspaceId: 'workspace-001',
      sourceArtifactId: 'artifact-source-001',
      mode: 'swarm_arena',
      experienceLayer: 'command',
      title: 'Swarm review',
      objective: 'Collect diverse review signals without weakening gates.',
      durationHours: 24,
      checkpointCadenceHours: 6,
      status: 'running',
      vdiTarget: 90,
      budgetCapCredits: 500,
      tokenCap: 2_000_000,
      storageCapBytes: 2_147_483_648,
      selectedAgentPackageIds: ['agent-a', 'agent-b'],
      requiredGateIds: ['schema', 'fact_check', 'logic_check'],
      createdAt,
      startedAt: createdAt,
    });

    const command = projectExperienceLayerView(mission, 'command');
    const game = projectExperienceLayerView(mission, 'game');
    const arena = projectExperienceLayerView(mission, 'arena');

    expect(command.presentationLabel).toBe('Mission Control');
    expect(game.presentationLabel).toBe('Quest Run');
    expect(arena.presentationLabel).toBe('Arena Mission');

    for (const view of [command, game, arena]) {
      expect(view.truth.missionId).toBe(mission.id);
      expect(view.truth.artifactIds).toEqual(['artifact-source-001']);
      expect(view.truth.requiredGateIds).toEqual(mission.requiredGateIds);
      expect(view.truth.validationSemanticsMutable).toBe(false);
      expect(view.truth.ledgerSemanticsMutable).toBe(false);
    }
  });

  it('calculates Verified Deliverable Index and related progression scores deterministically', () => {
    const vdi = calculateVerifiedDeliverableIndex({
      qualityScore: 80,
      executionReadiness: 70,
      validationGatePassRate: 90,
      reviewResolutionRate: 60,
      artifactCompleteness: 100,
      reproducibilityAuditScore: 80,
      criticalOpenRiskPenalty: 20,
      unsupportedClaimPenalty: 10,
    });

    expect(vdi).toBe(75);

    expect(
      calculateAgentExperience({
        acceptedUsefulContributions: 9,
        severeFindingsAccepted: 4,
        gatesImproved: 3,
        verifiedArtifactImpact: 12,
        duplicateNoisePenalty: 2,
        hallucinationPenalty: 1,
        permissionViolationPenalty: 5,
      }),
    ).toBe(20);

    expect(
      calculateSkillMastery({
        repeatedSuccessfulUse: 8,
        evidenceBackedArtifactImpact: 7,
        regressionPrevented: 3,
        reviewAccepted: 4,
        staleOrUnsupportedOutput: 6,
      }),
    ).toBe(16);
  });

  it('requires artifact or gate evidence before quests can complete', () => {
    const completed = assertQuestCompletionEvidence({
      id: 'quest-progress-complete',
      questId: 'quest-verify-001',
      userId: 'user-001',
      status: 'completed',
      percent: 100,
      evidenceRefs: ['artifact:artifact-001', 'gate:validation-001'],
      completedAt: createdAt,
    });

    expect(completed.status).toBe('completed');

    expect(() =>
      assertQuestCompletionEvidence({
        id: 'quest-progress-invalid',
        questId: 'quest-verify-001',
        userId: 'user-001',
        status: 'completed',
        percent: 100,
        evidenceRefs: ['note:looked-good'],
        completedAt: createdAt,
      }),
    ).toThrow('Completed quests require artifact or validation gate evidence');
  });

  it('keeps paid entitlements capacity-only and unable to satisfy gates', () => {
    const entitlement = SubscriptionEntitlementSchema.parse({
      id: 'entitlement-pro-001',
      userId: 'user-001',
      planId: 'arena-pro',
      swarmSlots: 100,
      maxMissionHours: 72,
      storageQuotaBytes: 10_737_418_240,
      privateAgentLimit: 50,
      publicMarketplaceAccess: true,
      createdAt,
    });

    expect(entitlement.swarmSlots).toBe(100);
    expect(paidEntitlementCanSatisfyValidationGate(entitlement, 'fact_check')).toBe(false);
    expect(paidEntitlementCanSatisfyValidationGate(entitlement, 'schema')).toBe(false);
  });

  it('does not mark long-running missions complete from elapsed time alone', () => {
    const elapsedOnly = evaluateMissionCompletion({
      missionId: 'mission-elapsed-only',
      elapsedHours: 24,
      durationHours: 24,
      requiredGateResults: [],
      criticalOpenFindings: 0,
    });

    expect(elapsedOnly.decision).toBe('fail');
    expect(elapsedOnly.reasons).toContain('missing_final_artifact');
    expect(elapsedOnly.reasons).toContain('missing_required_gate_results');

    const passed = evaluateMissionCompletion({
      missionId: 'mission-pass',
      elapsedHours: 24,
      durationHours: 24,
      finalArtifactId: 'artifact-final-001',
      requiredGateResults: [
        { gateId: 'schema', status: 'pass' },
        { gateId: 'fact_check', status: 'pass' },
      ],
      criticalOpenFindings: 0,
    });

    expect(passed.decision).toBe('pass');

    const warned = evaluateMissionCompletion({
      missionId: 'mission-warn',
      elapsedHours: 24,
      durationHours: 24,
      finalArtifactId: 'artifact-final-002',
      requiredGateResults: [
        { gateId: 'schema', status: 'pass' },
        { gateId: 'logic_check', status: 'warn' },
      ],
      criticalOpenFindings: 0,
    });

    expect(warned.decision).toBe('warn');

    const failed = evaluateMissionCompletion({
      missionId: 'mission-critical',
      elapsedHours: 24,
      durationHours: 24,
      finalArtifactId: 'artifact-final-003',
      requiredGateResults: [
        { gateId: 'schema', status: 'pass' },
        { gateId: 'security_check', status: 'fail', blocking: true },
      ],
      criticalOpenFindings: 1,
    });

    expect(failed.decision).toBe('fail');
    expect(failed.reasons).toContain('critical_open_findings');
    expect(failed.reasons).toContain('blocking_gate_failed');
  });
});
