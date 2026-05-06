import type {
  AgentPackage,
  AgentPackageRarity,
  AgentRiskLevel,
  ExperienceLayer,
  ExperienceTruthState,
  MissionMode,
  ProgressLedger,
  ValidationGate,
} from '@craft-agent/shared/workbench';

export type ArenaEntitlement = {
  maxSwarmSlots: number;
};

export type ArenaAgentCollectionItem = {
  package: AgentPackage;
  level: number;
  masteryPercent: number;
  unlocked: boolean;
  unlockCriteria: string[];
  roleTag: string;
  baseCostCredits: number;
  estimatedContributionCount: number;
};

export type ArenaRunEstimate = {
  swarmSlotsUsed: number;
  swarmSlotLimit: number;
  budgetEstimateCredits: number;
  estimatedContributionCount: number;
  trustFloor: number;
  validationGateIds: ValidationGate[];
};

export type ArenaBuilderStateInput = {
  roster?: ArenaAgentCollectionItem[];
  selectedAgentPackageIds?: string[];
  entitlement?: ArenaEntitlement;
};

export type ArenaDraftRun = {
  mode: MissionMode;
  experienceLayer: ExperienceLayer;
  selectedAgentPackageIds: string[];
  budgetEstimateCredits: number;
  estimatedContributionCount: number;
  requiredGateIds: ValidationGate[];
};

export type ArenaBuilderState = {
  roster: ArenaAgentCollectionItem[];
  selectedAgentPackageIds: string[];
  entitlement: ArenaEntitlement;
  runEstimate: ArenaRunEstimate;
  selectionWarnings: string[];
  canCreateDraft: boolean;
};

const ARENA_REQUIRED_GATES: ValidationGate[] = ['schema', 'logic_check', 'fact_check', 'security_check'];

export function createArenaBuilderState(input: ArenaBuilderStateInput = {}): ArenaBuilderState {
  const roster = input.roster ?? createDefaultArenaAgentRoster();
  const entitlement = sanitizeEntitlement(input.entitlement);
  const selected = normalizeSelectedAgentIds({
    roster,
    selectedAgentPackageIds: input.selectedAgentPackageIds ?? [],
    entitlement,
  });

  return {
    roster,
    selectedAgentPackageIds: selected.ids,
    entitlement,
    runEstimate: createArenaRunEstimate(roster, selected.ids, entitlement),
    selectionWarnings: selected.warnings,
    canCreateDraft: selected.ids.length > 0,
  };
}

export function createArenaBuilderStateFromTruth(
  truthState: ExperienceTruthState,
  input: ArenaBuilderStateInput = {},
): ArenaBuilderState {
  return createArenaBuilderState({
    ...input,
    roster: truthState.agentPackages.length > 0
      ? truthState.agentPackages.map((pkg) => createAgentFromPackage(pkg, truthState.ledger))
      : input.roster,
    selectedAgentPackageIds: input.selectedAgentPackageIds ?? truthState.mission.selectedAgentPackageIds,
    entitlement: input.entitlement ?? {
      maxSwarmSlots: Math.max(1, truthState.mission.selectedAgentPackageIds.length),
    },
  });
}

export function toggleArenaAgentSelection(state: ArenaBuilderState, agentPackageId: string): ArenaBuilderState {
  const agent = state.roster.find((item) => item.package.id === agentPackageId);
  if (!agent) return state;
  if (!agent.unlocked) {
    return createArenaBuilderState({
      roster: state.roster,
      selectedAgentPackageIds: state.selectedAgentPackageIds.concat(agentPackageId),
      entitlement: state.entitlement,
    });
  }

  const selectedAgentPackageIds = state.selectedAgentPackageIds.includes(agentPackageId)
    ? state.selectedAgentPackageIds.filter((id) => id !== agentPackageId)
    : state.selectedAgentPackageIds.concat(agentPackageId);

  return createArenaBuilderState({
    roster: state.roster,
    selectedAgentPackageIds,
    entitlement: state.entitlement,
  });
}

export function createArenaDraftRun(state: ArenaBuilderState): ArenaDraftRun {
  return {
    mode: 'swarm_arena',
    experienceLayer: 'arena',
    selectedAgentPackageIds: state.selectedAgentPackageIds,
    budgetEstimateCredits: state.runEstimate.budgetEstimateCredits,
    estimatedContributionCount: state.runEstimate.estimatedContributionCount,
    requiredGateIds: state.runEstimate.validationGateIds,
  };
}

export function createArenaRunEstimate(
  roster: ArenaAgentCollectionItem[],
  selectedAgentPackageIds: string[],
  entitlement: ArenaEntitlement,
): ArenaRunEstimate {
  const selectedAgents = selectedAgentPackageIds
    .map((id) => roster.find((item) => item.package.id === id))
    .filter((item): item is ArenaAgentCollectionItem => Boolean(item));

  return {
    swarmSlotsUsed: selectedAgents.length,
    swarmSlotLimit: entitlement.maxSwarmSlots,
    budgetEstimateCredits: selectedAgents.reduce((sum, item) => sum + item.baseCostCredits, 0),
    estimatedContributionCount: selectedAgents.reduce((sum, item) => sum + item.estimatedContributionCount, 0),
    trustFloor: selectedAgents.length === 0 ? 0 : Math.min(...selectedAgents.map((item) => item.package.trustScore)),
    validationGateIds: ARENA_REQUIRED_GATES,
  };
}

export function createDefaultArenaAgentRoster(): ArenaAgentCollectionItem[] {
  return [
    createAgent({
      id: 'agent-architect',
      name: 'Architect Prime',
      description: 'Maps system boundaries, dependencies, and implementation risks.',
      rarity: 'epic',
      riskLevel: 'medium',
      trustScore: 88,
      level: 7,
      masteryPercent: 74,
      unlocked: true,
      unlockCriteria: ['Complete 2 verified specs'],
      roleTag: 'Architecture',
      baseCostCredits: 24,
      estimatedContributionCount: 12,
    }),
    createAgent({
      id: 'agent-skeptic',
      name: 'Skeptic Sentinel',
      description: 'Attacks assumptions, contradictions, and missing validation evidence.',
      rarity: 'rare',
      riskLevel: 'low',
      trustScore: 91,
      level: 6,
      masteryPercent: 69,
      unlocked: true,
      unlockCriteria: ['Complete first review gate'],
      roleTag: 'Critique',
      baseCostCredits: 20,
      estimatedContributionCount: 10,
    }),
    createAgent({
      id: 'agent-researcher',
      name: 'Research Ranger',
      description: 'Finds evidence, source freshness, and minority reports.',
      rarity: 'epic',
      riskLevel: 'medium',
      trustScore: 84,
      level: 5,
      masteryPercent: 62,
      unlocked: true,
      unlockCriteria: ['Attach 5 cited sources'],
      roleTag: 'Research',
      baseCostCredits: 28,
      estimatedContributionCount: 14,
    }),
    createAgent({
      id: 'agent-qa',
      name: 'QA Gatekeeper',
      description: 'Turns findings into blocking gates and regression checks.',
      rarity: 'rare',
      riskLevel: 'low',
      trustScore: 86,
      level: 5,
      masteryPercent: 65,
      unlocked: true,
      unlockCriteria: ['Pass validation gate tutorial'],
      roleTag: 'Verification',
      baseCostCredits: 18,
      estimatedContributionCount: 9,
    }),
    createAgent({
      id: 'agent-locked-redteam',
      name: 'Red Team Oracle',
      description: 'Runs high-risk adversarial critique and exploit-path discovery.',
      rarity: 'legendary',
      riskLevel: 'critical',
      trustScore: 93,
      level: 1,
      masteryPercent: 0,
      unlocked: false,
      unlockCriteria: ['Reach VDI 85 on 3 missions', 'Enable private team registry trust checks'],
      roleTag: 'Adversarial',
      baseCostCredits: 64,
      estimatedContributionCount: 20,
    }),
  ];
}

function normalizeSelectedAgentIds(input: {
  roster: ArenaAgentCollectionItem[];
  selectedAgentPackageIds: string[];
  entitlement: ArenaEntitlement;
}): { ids: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const id of input.selectedAgentPackageIds) {
    const agent = input.roster.find((item) => item.package.id === id);
    if (!agent || seen.has(id)) continue;

    if (!agent.unlocked) {
      warnings.push(`${agent.package.name} is locked and cannot be selected.`);
      continue;
    }

    if (ids.length >= input.entitlement.maxSwarmSlots) {
      warnings.push(`Swarm selection is capped at ${input.entitlement.maxSwarmSlots} slots by current entitlement.`);
      break;
    }

    ids.push(id);
    seen.add(id);
  }

  return { ids, warnings };
}

function sanitizeEntitlement(entitlement?: ArenaEntitlement): ArenaEntitlement {
  return {
    maxSwarmSlots: Math.max(1, Math.floor(entitlement?.maxSwarmSlots ?? 3)),
  };
}

function createAgent(input: {
  id: string;
  name: string;
  description: string;
  rarity: AgentPackageRarity;
  riskLevel: AgentRiskLevel;
  trustScore: number;
  level: number;
  masteryPercent: number;
  unlocked: boolean;
  unlockCriteria: string[];
  roleTag: string;
  baseCostCredits: number;
  estimatedContributionCount: number;
}): ArenaAgentCollectionItem {
  const now = '2026-04-30T00:00:00.000Z';
  return {
    package: {
      id: input.id,
      packageType: 'persona',
      name: input.name,
      description: input.description,
      visibility: 'built_in',
      rarity: input.rarity,
      trustScore: input.trustScore,
      riskLevel: input.riskLevel,
      permissionProfileId: `permission-${input.id}`,
      latestVersion: '1.0.0',
      pricingModel: 'included',
      createdAt: now,
      updatedAt: now,
    },
    level: input.level,
    masteryPercent: input.masteryPercent,
    unlocked: input.unlocked,
    unlockCriteria: input.unlockCriteria,
    roleTag: input.roleTag,
    baseCostCredits: input.baseCostCredits,
    estimatedContributionCount: input.estimatedContributionCount,
  };
}

function createAgentFromPackage(pkg: AgentPackage, ledger: ProgressLedger[] = []): ArenaAgentCollectionItem {
  const masteryBonus = ledger
    .filter((entry) => entry.currency === 'mastery')
    .filter((entry) =>
      entry.sourceArtifactId === `artifact:${pkg.id}:usage` ||
      entry.validationGateResultId === `gate:${pkg.id}:verified-usage`
    )
    .reduce((sum, entry) => sum + entry.amount, 0);
  const masteryPercent = Math.min(100, Math.max(0, Math.round(pkg.trustScore + masteryBonus)));

  return {
    package: pkg,
    level: Math.max(1, Math.round(pkg.trustScore / 12)),
    masteryPercent,
    unlocked: true,
    unlockCriteria: ['Provided by shared truth state'],
    roleTag: pkg.packageType === 'skill_pack' || pkg.packageType === 'skill' ? 'Automation' : 'Research',
    baseCostCredits: Math.max(12, Math.round((100 - pkg.trustScore) / 2) + 12),
    estimatedContributionCount: Math.max(1, Math.round(pkg.trustScore / 10)),
  };
}
