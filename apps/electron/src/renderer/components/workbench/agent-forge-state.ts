import type {
  AgentPackage,
  AgentPackageVisibility,
  ExperienceTruthState,
  SkillContract,
} from '@craft-agent/shared/workbench';
import { assertPublicPackagePublishable } from '@craft-agent/shared/workbench/experience-layer-security';

export type ForgeTrustInput = {
  reviewCount: number;
  passingTestCount: number;
  promptInjectionWarnings: string[];
};

export type AgentForgeState = {
  packages: AgentPackage[];
  contractsByPackageId: Record<string, SkillContract | undefined>;
  reviewsByPackageId: Record<string, number>;
  testsByPackageId: Record<string, number>;
  promptInjectionWarningsByPackageId: Record<string, string[]>;
  installedPackageIds: string[];
  viewerTeamId: string;
};

export type AgentForgeStateInput = Partial<AgentForgeState>;

export function createAgentForgeState(input: AgentForgeStateInput = {}): AgentForgeState {
  return {
    packages: input.packages ?? createForgePackages(),
    contractsByPackageId: input.contractsByPackageId ?? createContractsByPackageId(),
    reviewsByPackageId: input.reviewsByPackageId ?? {
      'pkg-team-critic': 2,
      'pkg-no-contract': 1,
      'pkg-injection-risk': 2,
    },
    testsByPackageId: input.testsByPackageId ?? {
      'pkg-team-critic': 4,
      'pkg-no-contract': 2,
      'pkg-injection-risk': 4,
    },
    promptInjectionWarningsByPackageId: input.promptInjectionWarningsByPackageId ?? {
      'pkg-injection-risk': ['Instruction override phrase detected in system prompt.'],
    },
    installedPackageIds: input.installedPackageIds ?? [],
    viewerTeamId: input.viewerTeamId ?? 'team-alpha',
  };
}

export function createAgentForgeStateFromTruth(
  truthState: ExperienceTruthState,
  input: AgentForgeStateInput = {},
): AgentForgeState {
  return createAgentForgeState({
    ...input,
    packages: truthState.agentPackages.length > 0 ? truthState.agentPackages : input.packages,
    installedPackageIds: truthState.installedAgentPackageIds,
    viewerTeamId: input.viewerTeamId ?? truthState.agentPackages.find((pkg) => pkg.ownerTeamId)?.ownerTeamId ?? 'team-alpha',
  });
}

export function installAgentPackage(state: AgentForgeState, packageId: string): AgentForgeState {
  const contract = state.contractsByPackageId[packageId];
  if (!contract) {
    throw new Error('Agent package cannot install without a skill contract.');
  }

  if (state.installedPackageIds.includes(packageId)) return state;
  return {
    ...state,
    installedPackageIds: state.installedPackageIds.concat(packageId),
  };
}

export function publishAgentPackage(
  state: AgentForgeState,
  packageId: string,
  targetVisibility: AgentPackageVisibility,
): AgentForgeState {
  const pkg = state.packages.find((candidate) => candidate.id === packageId);
  if (!pkg) {
    throw new Error('Agent package not found.');
  }

  const warnings = state.promptInjectionWarningsByPackageId[packageId] ?? [];
  if (targetVisibility === 'public') {
    assertPublicPackagePublishable({
      promptInjectionWarnings: warnings,
      hasContract: Boolean(state.contractsByPackageId[packageId]),
      reviewCount: state.reviewsByPackageId[packageId] ?? 0,
      passingTestCount: state.testsByPackageId[packageId] ?? 0,
      trustScore: pkg.trustScore,
      minimumTrustScore: 50,
    });
  }

  return {
    ...state,
    packages: state.packages.map((pkg) => (pkg.id === packageId ? { ...pkg, visibility: targetVisibility } : pkg)),
  };
}

export function calculateForgeTrustScore(input: ForgeTrustInput): number {
  if (input.reviewCount <= 0 || input.passingTestCount <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, input.reviewCount * 20 + input.passingTestCount * 10 - input.promptInjectionWarnings.length * 30),
  );
}

export function listVisibleAgentPackages(
  state: AgentForgeState,
  viewer: { viewerTeamId: string; viewerUserId?: string },
): AgentPackage[] {
  return state.packages.filter((pkg) => {
    if (pkg.visibility === 'public' || pkg.visibility === 'built_in') return true;
    if (pkg.visibility === 'team') return pkg.ownerTeamId === viewer.viewerTeamId;
    if (pkg.visibility === 'private' && pkg.ownerUserId) return pkg.ownerUserId === viewer.viewerUserId;
    if (pkg.visibility === 'private') return pkg.ownerTeamId === viewer.viewerTeamId;
    return false;
  });
}

export function getPackageTrustScore(state: AgentForgeState, packageId: string): number {
  return calculateForgeTrustScore({
    reviewCount: state.reviewsByPackageId[packageId] ?? 0,
    passingTestCount: state.testsByPackageId[packageId] ?? 0,
    promptInjectionWarnings: state.promptInjectionWarningsByPackageId[packageId] ?? [],
  });
}

function createForgePackages(): AgentPackage[] {
  return [
    createPackage({
      id: 'pkg-team-critic',
      name: 'Team Critic',
      description: 'Private team reviewer for consistency, evidence, and fix plans.',
      visibility: 'team',
      ownerTeamId: 'team-alpha',
      trustScore: 80,
    }),
    createPackage({
      id: 'pkg-no-contract',
      name: 'Loose Prompt Pack',
      description: 'Legacy prompt pack missing a formal contract.',
      visibility: 'team',
      ownerTeamId: 'team-alpha',
      trustScore: 30,
    }),
    createPackage({
      id: 'pkg-injection-risk',
      name: 'Risky Public Persona',
      description: 'Persona candidate with unresolved prompt-injection warning.',
      visibility: 'team',
      ownerTeamId: 'team-alpha',
      trustScore: 50,
    }),
  ];
}

function createContractsByPackageId(): Record<string, SkillContract | undefined> {
  return {
    'pkg-team-critic': createContract('contract-team-critic', 'pkg-team-critic'),
    'pkg-injection-risk': createContract('contract-injection-risk', 'pkg-injection-risk'),
  };
}

function createPackage(input: {
  id: string;
  name: string;
  description: string;
  visibility: AgentPackageVisibility;
  ownerTeamId: string;
  trustScore: number;
}): AgentPackage {
  const now = '2026-04-30T00:00:00.000Z';
  return {
    id: input.id,
    packageType: 'persona',
    name: input.name,
    description: input.description,
    ownerTeamId: input.ownerTeamId,
    visibility: input.visibility,
    rarity: 'rare',
    trustScore: input.trustScore,
    riskLevel: 'medium',
    permissionProfileId: `permission-${input.id}`,
    latestVersion: '1.0.0',
    pricingModel: 'team_private',
    createdAt: now,
    updatedAt: now,
  };
}

function createContract(id: string, packageId: string): SkillContract {
  return {
    id,
    packageId,
    inputSchema: { task: 'string' },
    outputSchema: { findings: 'array' },
    examples: [{ input: { task: 'Review artifact' }, output: { findings: [] } }],
    requiredTools: ['workspace.read'],
    requiredPermissions: ['read_artifacts'],
    requiredValidationGates: ['schema', 'logic_check'],
    failureModes: ['unsupported_claim', 'missing_evidence'],
    testFixtures: ['fixture:artifact-review'],
  };
}
