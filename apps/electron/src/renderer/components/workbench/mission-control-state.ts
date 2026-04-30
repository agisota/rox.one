import type {
  MissionCheckpoint,
  MissionCheckpointStatus,
  MissionGateResult,
  MissionRun,
} from '@rox-agent/shared/workbench';

export type MissionApprovalStatus = 'pending' | 'approved' | 'rejected';

export type MissionApprovalRequest = {
  id: string;
  title: string;
  description: string;
  branchType: 'expensive' | 'risk' | 'external_tool';
  status: MissionApprovalStatus;
  requestedAt: string;
  resolvedAt?: string;
};

export type MissionFeedItem = {
  id: string;
  checkpointId: string;
  source: string;
  summary: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
};

export type MissionArtifactItem = {
  id: string;
  checkpointId: string;
  title: string;
  artifactType: 'memo' | 'map' | 'report' | 'fix_plan';
  validationState: 'draft' | 'warn' | 'passed' | 'failed';
};

export type MissionAuditEvent = {
  id: string;
  summary: string;
  createdAt: string;
};

export type MissionBillingTraceItem = {
  id: string;
  label: string;
  credits: number;
  source: string;
};

export type MissionControlState = {
  mission: MissionRun;
  checkpoints: MissionCheckpoint[];
  gateResults: MissionGateResult[];
  approvals: MissionApprovalRequest[];
  feedItems: MissionFeedItem[];
  artifacts: MissionArtifactItem[];
  auditEvents: MissionAuditEvent[];
  billingTrace: MissionBillingTraceItem[];
  blockingReasons: string[];
  canRunExpensiveBranch: boolean;
  canFinalize: boolean;
};

export function createMissionControlState(input: Partial<MissionControlState> = {}): MissionControlState {
  const state = {
    mission: input.mission ?? createMissionRun(),
    checkpoints: input.checkpoints ?? createMissionCheckpoints(),
    gateResults: input.gateResults ?? createMissionGateResults(),
    approvals: input.approvals ?? createMissionApprovals(),
    feedItems: input.feedItems ?? createMissionFeedItems(),
    artifacts: input.artifacts ?? createMissionArtifacts(),
    auditEvents: input.auditEvents ?? createMissionAuditEvents(),
    billingTrace: input.billingTrace ?? createMissionBillingTrace(),
  };
  return deriveMissionControlState(state);
}

export function transitionMissionCheckpoint(
  state: MissionControlState,
  checkpointId: string,
  status: MissionCheckpointStatus,
): MissionControlState {
  const checkpoint = state.checkpoints.find((item) => item.id === checkpointId);
  if (!checkpoint) return state;

  return createMissionControlState({
    ...state,
    checkpoints: state.checkpoints.map((item) => (item.id === checkpointId ? { ...item, status } : item)),
    auditEvents: state.auditEvents.concat({
      id: `audit-${checkpointId}-${status}`,
      summary: `Checkpoint ${checkpoint.title} moved to ${status}.`,
      createdAt: '2026-04-30T00:00:00.000Z',
    }),
  });
}

export function approveMissionBranch(state: MissionControlState, approvalId: string): MissionControlState {
  return createMissionControlState({
    ...state,
    approvals: state.approvals.map((approval) =>
      approval.id === approvalId
        ? { ...approval, status: 'approved', resolvedAt: '2026-04-30T00:00:00.000Z' }
        : approval,
    ),
  });
}

function deriveMissionControlState(
  state: Omit<MissionControlState, 'blockingReasons' | 'canRunExpensiveBranch' | 'canFinalize'>,
): MissionControlState {
  const blockingReasons: string[] = [];
  const pendingExpensiveApproval = state.approvals.find(
    (approval) => approval.branchType === 'expensive' && approval.status === 'pending',
  );
  const blockingGateFailures = state.gateResults.filter((gate) => gate.status === 'fail' && gate.blocking);

  if (pendingExpensiveApproval) {
    blockingReasons.push(`Approval required for expensive branch: ${pendingExpensiveApproval.title}.`);
  }

  for (const gate of blockingGateFailures) {
    blockingReasons.push(`Critical validation gate failed: ${gate.gateId}.`);
  }

  return {
    ...state,
    blockingReasons,
    canRunExpensiveBranch: !pendingExpensiveApproval,
    canFinalize: blockingReasons.length === 0,
  };
}

function createMissionRun(): MissionRun {
  return {
    id: 'mission-24h-launch-review',
    ownerUserId: 'user-one',
    workspaceId: 'workspace-main',
    mode: 'swarm_arena',
    experienceLayer: 'arena',
    title: '24h launch review swarm',
    objective: 'Produce a verified blocker map and final fix plan.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status: 'running',
    vdiTarget: 82,
    budgetCapCredits: 420,
    tokenCap: 1_000_000,
    storageCapBytes: 1_073_741_824,
    selectedAgentPackageIds: ['agent-architect', 'agent-skeptic', 'agent-researcher', 'agent-qa'],
    requiredGateIds: ['schema', 'logic_check', 'fact_check', 'security_check'],
    createdAt: '2026-04-30T00:00:00.000Z',
    startedAt: '2026-04-30T00:00:00.000Z',
  };
}

function createMissionCheckpoints(): MissionCheckpoint[] {
  return [
    createCheckpoint('cp-0h', 0, 'Mission brief', 'completed'),
    createCheckpoint('cp-6h', 1, 'Checkpoint 6h', 'completed'),
    createCheckpoint('cp-12h', 2, 'Checkpoint 12h', 'running'),
    createCheckpoint('cp-18h', 3, 'Checkpoint 18h', 'queued'),
    createCheckpoint('cp-24h', 4, 'Final verification', 'queued'),
  ];
}

function createCheckpoint(
  id: string,
  ordinal: number,
  title: string,
  status: MissionCheckpointStatus,
): MissionCheckpoint {
  return {
    id,
    missionRunId: 'mission-24h-launch-review',
    ordinal,
    dueAt: `2026-04-30T${String(ordinal * 6).padStart(2, '0')}:00:00.000Z`,
    title,
    summary: `${title} summary`,
    artifactIds: id === 'cp-6h' ? ['artifact-contradiction-map'] : id === 'cp-12h' ? ['artifact-evidence-memo'] : [],
    vdiDelta: ordinal * 2,
    status,
  };
}

function createMissionGateResults(): MissionGateResult[] {
  return [
    { gateId: 'schema', status: 'pass', evidenceRef: 'gate:schema:passed' },
    { gateId: 'logic_check', status: 'warn', evidenceRef: 'gate:logic:warn' },
    { gateId: 'fact_check', status: 'pass', evidenceRef: 'gate:fact:passed' },
    { gateId: 'security_check', status: 'fail', blocking: true, evidenceRef: 'gate:security:failed' },
  ];
}

function createMissionApprovals(): MissionApprovalRequest[] {
  return [
    {
      id: 'approval-expensive-branch',
      title: '100-agent swarm expansion',
      description: 'Requires explicit approval before spending extra budget.',
      branchType: 'expensive',
      status: 'pending',
      requestedAt: '2026-04-30T06:00:00.000Z',
    },
  ];
}

function createMissionFeedItems(): MissionFeedItem[] {
  return [
    {
      id: 'feed-1',
      checkpointId: 'cp-6h',
      source: 'Skeptic Sentinel',
      summary: 'Launch plan has unresolved dependency on manual review.',
      severity: 'high',
    },
    {
      id: 'feed-2',
      checkpointId: 'cp-12h',
      source: 'Research Ranger',
      summary: 'Two source claims need freshness verification.',
      severity: 'medium',
    },
  ];
}

function createMissionArtifacts(): MissionArtifactItem[] {
  return [
    {
      id: 'artifact-contradiction-map',
      checkpointId: 'cp-6h',
      title: '6h contradiction map',
      artifactType: 'map',
      validationState: 'warn',
    },
    {
      id: 'artifact-evidence-memo',
      checkpointId: 'cp-12h',
      title: '12h evidence memo',
      artifactType: 'memo',
      validationState: 'draft',
    },
  ];
}

function createMissionAuditEvents(): MissionAuditEvent[] {
  return [
    {
      id: 'audit-1',
      summary: 'Mission started with 4 selected agents.',
      createdAt: '2026-04-30T00:00:00.000Z',
    },
  ];
}

function createMissionBillingTrace(): MissionBillingTraceItem[] {
  return [
    {
      id: 'billing-1',
      label: 'Initial swarm pass',
      credits: 90,
      source: 'fake-ledger',
    },
  ];
}
