import {
  ProgressLedgerSchema,
  type ExperienceTruthState,
  type MetricSnapshot,
  type ProgressLedger,
} from '@rox-agent/shared/workbench';

export type ProgressionEntitlement = {
  swarmSlots: number;
  maxMissionHours: number;
};

export type ProgressionCapacity = {
  swarmSlots: number;
  maxMissionHours: number;
};

export type LeaderboardPolicy = {
  showLeaderboards: boolean;
  viewerTeamId?: string;
};

export type LeaderboardRow = {
  id: string;
  displayName: string;
  teamId?: string;
  score: number;
  visibility: 'public' | 'team_private';
};

export type ProgressionStateInput = {
  latestSnapshot?: MetricSnapshot;
  ledger?: ProgressLedger[];
  leaderboardRows?: LeaderboardRow[];
  leaderboardPolicy?: LeaderboardPolicy;
  entitlement?: ProgressionEntitlement;
};

export type ProgressionState = {
  latestSnapshot: MetricSnapshot;
  ledger: ProgressLedger[];
  leaderboardRows: LeaderboardRow[];
  leaderboardPolicy: LeaderboardPolicy;
  entitlement: ProgressionEntitlement;
  capacity: ProgressionCapacity;
};

export function createProgressionState(input: ProgressionStateInput = {}): ProgressionState {
  const entitlement = sanitizeEntitlement(input.entitlement);
  return {
    latestSnapshot: input.latestSnapshot ?? createMetricSnapshot(),
    ledger: input.ledger ?? createProgressLedger(),
    leaderboardRows: input.leaderboardRows ?? createLeaderboardRows(),
    leaderboardPolicy: input.leaderboardPolicy ?? { showLeaderboards: true, viewerTeamId: 'team-alpha' },
    entitlement,
    capacity: {
      swarmSlots: entitlement.swarmSlots,
      maxMissionHours: entitlement.maxMissionHours,
    },
  };
}

export function createProgressionStateFromTruth(
  truthState: ExperienceTruthState,
  input: ProgressionStateInput = {},
): ProgressionState {
  return createProgressionState({
    ...input,
    latestSnapshot: selectLatestMetricSnapshot(truthState.metricSnapshots) ?? input.latestSnapshot,
    ledger: truthState.ledger,
    leaderboardPolicy: input.leaderboardPolicy ?? {
      showLeaderboards: true,
      viewerTeamId: truthState.mission.teamId,
    },
  });
}

export function appendProgressLedgerEvent(state: ProgressionState, entry: ProgressLedger): ProgressionState {
  const parsed = ProgressLedgerSchema.parse(entry);
  return {
    ...state,
    ledger: state.ledger.concat(parsed),
  };
}

export function projectLeaderboardRows(state: ProgressionState): LeaderboardRow[] {
  if (!state.leaderboardPolicy.showLeaderboards) return [];

  return state.leaderboardRows.filter((row) => {
    if (row.visibility === 'public') return true;
    return Boolean(row.teamId && row.teamId === state.leaderboardPolicy.viewerTeamId);
  });
}

function sanitizeEntitlement(entitlement?: ProgressionEntitlement): ProgressionEntitlement {
  return {
    swarmSlots: Math.max(0, Math.floor(entitlement?.swarmSlots ?? 4)),
    maxMissionHours: Math.max(1, entitlement?.maxMissionHours ?? 24),
  };
}

function selectLatestMetricSnapshot(snapshots: MetricSnapshot[]): MetricSnapshot | undefined {
  return [...snapshots].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

function createMetricSnapshot(): MetricSnapshot {
  return {
    id: 'metric-snapshot-1',
    missionRunId: 'mission-24h-launch-review',
    userId: 'user-one',
    teamId: 'team-alpha',
    qualityScore: 82,
    executionReadiness: 78,
    verifiedDeliverableIndex: 86,
    costEfficiency: 1.7,
    openRiskScore: 22,
    noiseScore: 8,
    evidenceRefs: ['artifact:final-fix-plan', 'gate:security:passed'],
    createdAt: '2026-04-30T00:00:00.000Z',
  };
}

function createProgressLedger(): ProgressLedger[] {
  return [
    {
      id: 'ledger-xp-1',
      userId: 'user-one',
      teamId: 'team-alpha',
      eventType: 'xp',
      amount: 120,
      currency: 'xp',
      reason: 'Accepted verified mission artifact',
      sourceArtifactId: 'artifact:final-fix-plan',
      createdAt: '2026-04-30T00:00:00.000Z',
    },
    {
      id: 'ledger-credit-1',
      userId: 'user-one',
      teamId: 'team-alpha',
      eventType: 'credit',
      amount: -90,
      currency: 'credits',
      reason: 'Initial swarm pass',
      createdAt: '2026-04-30T00:00:00.000Z',
    },
  ];
}

function createLeaderboardRows(): LeaderboardRow[] {
  return [
    {
      id: 'leader-rox-core',
      displayName: 'ROX Core',
      teamId: 'team-alpha',
      score: 86,
      visibility: 'team_private',
    },
    {
      id: 'leader-alpha-team',
      displayName: 'Alpha Team',
      teamId: 'team-alpha',
      score: 81,
      visibility: 'public',
    },
    {
      id: 'leader-beta-team',
      displayName: 'Beta Team',
      teamId: 'team-beta',
      score: 79,
      visibility: 'team_private',
    },
  ];
}
