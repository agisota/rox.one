import type {
  ExperienceEvent,
  ExperienceRuntimeState,
  ExperienceRuntimeStore,
  ExperienceTruthState,
  MissionCheckpoint,
  MissionCheckpointStatus,
  MissionGateResult,
  MissionRun,
  ProgressLedger,
  ValidationGate,
} from '@rox-one/shared/workbench';
import {
  canFinalizeMissionRun,
  selectActiveExperienceTruthState,
} from '@rox-one/shared/workbench';

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

export type RuntimeCheckpointCompletionInput = {
  runtimeStore: ExperienceRuntimeStore;
  missionRunId: string;
  checkpointId: string;
  now: string;
  artifactId: string;
  artifactTitle: string;
  gateId: ValidationGate;
  gateEvidenceRef: string;
  costCredits: number;
  summary: string;
};

export type RuntimeCheckpointControlActionInput = {
  runtimeStore: ExperienceRuntimeStore;
  checkpointId: string;
  now: string;
  gateId?: ValidationGate;
  artifactId?: string;
  artifactTitle?: string;
  gateEvidenceRef?: string;
  costCredits?: number;
  summary?: string;
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

export function createMissionControlStateFromTruth(truthState: ExperienceTruthState): MissionControlState {
  const artifacts = truthState.checkpoints.flatMap((checkpoint) =>
    checkpoint.artifactIds.map((artifactId) => ({
      id: artifactId,
      checkpointId: checkpoint.id,
      title: artifactId,
      artifactType: 'report' as const,
      validationState: checkpoint.status === 'failed' ? 'failed' as const : checkpoint.status === 'completed' ? 'passed' as const : 'draft' as const,
    })),
  );

  return createMissionControlState({
    mission: truthState.mission,
    checkpoints: truthState.checkpoints,
    gateResults: truthState.gateResults,
    approvals: [],
    feedItems: truthState.checkpoints.map((checkpoint) => ({
      id: `feed-${checkpoint.id}`,
      checkpointId: checkpoint.id,
      source: 'Mission truth',
      summary: checkpoint.summary || checkpoint.title,
      severity: checkpoint.status === 'failed' || checkpoint.status === 'blocked' ? 'high' : 'info',
    })),
    artifacts,
    auditEvents: truthState.checkpoints.map((checkpoint) => ({
      id: `audit-${checkpoint.id}-${checkpoint.status}`,
      summary: `Checkpoint ${checkpoint.title} moved to ${checkpoint.status}.`,
      createdAt: checkpoint.completedAt ?? truthState.mission.startedAt ?? truthState.mission.createdAt,
    })),
    billingTrace: truthState.ledger.filter(isCreditLedgerEntry).map((entry) => ({
      id: entry.id,
      label: entry.reason,
      credits: entry.amount,
      source: entry.sourceArtifactId ?? entry.validationGateResultId ?? 'truth-ledger',
    })),
  });
}

export function createMissionControlStateFromRuntime(runtimeState: ExperienceRuntimeState): MissionControlState {
  return createMissionControlStateFromTruth(selectActiveExperienceTruthState(runtimeState));
}

export async function completeMissionCheckpointThroughRuntime(
  _state: MissionControlState,
  input: RuntimeCheckpointCompletionInput,
): Promise<MissionControlState> {
  const events = createCheckpointCompletionEvents(input);

  for (const event of events) {
    await input.runtimeStore.dispatch(event);
  }

  return createMissionControlStateFromRuntime(input.runtimeStore.getState());
}

export async function completeMissionCheckpointFromControlAction(
  state: MissionControlState,
  input: RuntimeCheckpointControlActionInput,
): Promise<MissionControlState> {
  const checkpoint = state.checkpoints.find((item) => item.id === input.checkpointId);
  if (!checkpoint) return state;

  const gateId = input.gateId ?? state.mission.requiredGateIds[0] ?? 'schema';
  return completeMissionCheckpointThroughRuntime(state, {
    runtimeStore: input.runtimeStore,
    missionRunId: state.mission.id,
    checkpointId: checkpoint.id,
    now: input.now,
    artifactId: input.artifactId ?? `artifact:${state.mission.id}:${checkpoint.id}:completion`,
    artifactTitle: input.artifactTitle ?? `${checkpoint.title} evidence`,
    gateId,
    gateEvidenceRef: input.gateEvidenceRef ?? `gate:${state.mission.id}:${checkpoint.id}:${gateId}:passed`,
    costCredits: input.costCredits ?? 0,
    summary: (input.summary ?? checkpoint.summary) || `${checkpoint.title} completed.`,
  });
}

export async function finalizeMissionFromControlAction(
  state: MissionControlState,
  input: { runtimeStore: ExperienceRuntimeStore; now: string },
): Promise<MissionControlState> {
  if (!state.canFinalize) return state;

  const finalCheckpoint = state.checkpoints[state.checkpoints.length - 1];
  const finalArtifact = finalCheckpoint
    ? state.artifacts.find((artifact) => artifact.checkpointId === finalCheckpoint.id && artifact.validationState === 'passed')
    : undefined;
  const gateEvidenceRefs = state.gateResults
    .filter((gate) => gate.status === 'pass' && gate.evidenceRef)
    .map((gate) => gate.evidenceRef as string);

  await input.runtimeStore.dispatch({
    id: `event:${state.mission.id}:finalized:${input.now}`,
    type: 'mission.finalized',
    createdAt: input.now,
    aggregateId: state.mission.id,
    payload: {
      missionRunId: state.mission.id,
      finalArtifactId: finalArtifact?.id,
      gateEvidenceRefs,
    },
  });

  return createMissionControlStateFromRuntime(input.runtimeStore.getState());
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
  const finalCheckpoint = state.checkpoints.at(-1);
  const finalArtifact = finalCheckpoint
    ? state.artifacts.find((artifact) => artifact.checkpointId === finalCheckpoint.id && artifact.validationState === 'passed')
    : undefined;
  const finalization = canFinalizeMissionRun({
    mission: state.mission,
    finalArtifactId: finalArtifact?.id,
    gateEvidenceRefs: state.gateResults
      .filter((gate) => gate.status === 'pass' && gate.evidenceRef)
      .map((gate) => gate.evidenceRef as string),
    artifacts: state.artifacts.map((artifact) => ({ id: artifact.id, missionRunId: state.mission.id })),
    gateResults: state.gateResults.map((gate) => ({ ...gate, missionRunId: state.mission.id })),
  });

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
    canFinalize: blockingReasons.length === 0 && finalization.allowed,
  };
}

function isCreditLedgerEntry(entry: ProgressLedger): boolean {
  return entry.currency === 'credits';
}

function createCheckpointCompletionEvents(input: RuntimeCheckpointCompletionInput): ExperienceEvent[] {
  const baseId = `${input.missionRunId}:${input.checkpointId}:${input.artifactId}`;
  return [
    {
      id: `${baseId}:artifact`,
      type: 'artifact.created',
      createdAt: input.now,
      aggregateId: input.missionRunId,
      payload: {
        artifact: {
          id: input.artifactId,
          missionRunId: input.missionRunId,
          checkpointId: input.checkpointId,
          artifactType: 'report',
          title: input.artifactTitle,
          evidenceRefs: [input.gateEvidenceRef],
          createdAt: input.now,
        },
      },
    },
    {
      id: `${baseId}:gate`,
      type: 'gate.passed',
      createdAt: input.now,
      aggregateId: input.missionRunId,
      payload: {
        missionRunId: input.missionRunId,
        gateId: input.gateId,
        evidenceRef: input.gateEvidenceRef,
      },
    },
    {
      id: `${baseId}:checkpoint-completed`,
      type: 'mission.checkpoint.completed',
      createdAt: input.now,
      aggregateId: input.missionRunId,
      payload: {
        missionRunId: input.missionRunId,
        checkpointId: input.checkpointId,
        summary: input.summary,
        artifactIds: [input.artifactId],
        vdiDelta: 5,
      },
    },
    {
      id: `${baseId}:ledger`,
      type: 'ledger.entry.recorded',
      createdAt: input.now,
      aggregateId: input.missionRunId,
      payload: {
        entry: {
          id: `ledger-${input.checkpointId}-${input.artifactId}`,
          eventType: 'credit',
          amount: input.costCredits,
          currency: 'credits',
          reason: `Checkpoint ${input.checkpointId} execution`,
          sourceArtifactId: input.artifactId,
          validationGateResultId: input.gateEvidenceRef,
          createdAt: input.now,
        },
      },
    },
  ];
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
