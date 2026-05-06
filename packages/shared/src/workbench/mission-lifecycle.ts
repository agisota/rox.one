import {
  MissionRunSchema,
  type MissionGateResult,
  type MissionRun,
  type MissionRunStatus,
} from './experience-layer';

export type MissionLifecycleArtifact = {
  id: string;
  missionRunId?: string;
};

export type MissionLifecycleGateResult = MissionGateResult & {
  missionRunId?: string;
};

export type MissionLifecycleFinalizationInput = {
  mission: MissionRun;
  finalArtifactId?: string;
  gateEvidenceRefs: string[];
  artifacts: MissionLifecycleArtifact[];
  gateResults: MissionLifecycleGateResult[];
};

export type MissionLifecycleFinalizationDecision = {
  allowed: boolean;
  reasons: string[];
};

export type MissionSchedulerLifecycleEvent = {
  id: string;
  missionRunId: string;
  type: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

const TERMINAL_STATUSES = new Set<MissionRunStatus>(['completed', 'failed', 'cancelled']);

const ALLOWED_TRANSITIONS: Record<MissionRunStatus, MissionRunStatus[]> = {
  draft: ['queued', 'cancelled'],
  queued: ['running', 'paused', 'waiting_for_approval', 'failed', 'cancelled'],
  running: ['paused', 'waiting_for_approval', 'completed', 'failed', 'cancelled'],
  waiting_for_approval: ['running', 'paused', 'failed', 'cancelled'],
  paused: ['running', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function normalizeMissionRunForLaunch(mission: MissionRun, startedAt: string): MissionRun {
  return MissionRunSchema.parse({
    ...mission,
    status: 'queued',
    startedAt: mission.startedAt ?? startedAt,
  });
}

export function assertMissionRunTransition(
  previous: MissionRunStatus,
  next: MissionRunStatus,
): MissionRunStatus {
  if (previous === next) return next;
  if (ALLOWED_TRANSITIONS[previous].includes(next)) return next;
  throw new Error(`Invalid MissionRun status transition: ${previous} -> ${next}`);
}

export function isExecutableMissionRunStatus(status: MissionRunStatus): boolean {
  return status === 'queued' || status === 'running';
}

export function isTerminalMissionRunStatus(status: MissionRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canFinalizeMissionRun(
  input: MissionLifecycleFinalizationInput,
): MissionLifecycleFinalizationDecision {
  const mission = MissionRunSchema.parse(input.mission);
  const reasons: string[] = [];

  if (!input.finalArtifactId) {
    reasons.push('missing_final_artifact');
  }

  if (input.gateEvidenceRefs.length === 0) {
    reasons.push('missing_gate_evidence');
  }

  const finalArtifact = input.finalArtifactId
    ? input.artifacts.find((artifact) =>
        artifact.id === input.finalArtifactId
        && (!artifact.missionRunId || artifact.missionRunId === mission.id),
      )
    : undefined;
  if (input.finalArtifactId && !finalArtifact) {
    reasons.push('missing_stored_final_artifact');
  }

  const hasPassingGateEvidence = input.gateEvidenceRefs.some((evidenceRef) =>
    input.gateResults.some((gate) =>
      gate.evidenceRef === evidenceRef
      && gate.status === 'pass'
      && (!gate.missionRunId || gate.missionRunId === mission.id),
    ),
  );
  if (input.gateEvidenceRefs.length > 0 && !hasPassingGateEvidence) {
    reasons.push('missing_passing_gate_evidence');
  }

  const hasBlockingFailedGate = input.gateResults.some((gate) =>
    gate.missionRunId === mission.id
    && gate.status === 'fail'
    && gate.blocking,
  );
  if (hasBlockingFailedGate) {
    reasons.push('blocking_gate_failed');
  }

  return {
    allowed: reasons.length === 0,
    reasons: uniqueStrings(reasons),
  };
}

export function projectMissionRunStatusFromSchedulerEvents(
  mission: MissionRun,
  events: MissionSchedulerLifecycleEvent[],
): MissionRunStatus {
  MissionRunSchema.parse(mission);
  return events
    .filter((event) => event.missionRunId === mission.id)
    .reduce<MissionRunStatus>((status, event) => {
      if (isTerminalMissionRunStatus(status)) return status;
      return projectMissionRunStatusFromSchedulerEvent(status, event);
    }, mission.status);
}

function projectMissionRunStatusFromSchedulerEvent(
  current: MissionRunStatus,
  event: MissionSchedulerLifecycleEvent,
): MissionRunStatus {
  const next = schedulerEventStatus(event.type, current);
  if (next === current) return current;
  return assertMissionRunTransition(current, next);
}

function schedulerEventStatus(type: string, current: MissionRunStatus): MissionRunStatus {
  switch (type) {
    case 'mission_queued':
      return 'queued';
    case 'checkpoint_completed':
    case 'branch_expansion_approved':
      return 'running';
    case 'checkpoint_budget_blocked':
    case 'branch_expansion_blocked':
      return 'paused';
    case 'branch_expansion_waiting_for_approval':
      return 'waiting_for_approval';
    case 'mission_completed':
      return 'completed';
    case 'mission_failed':
      return 'failed';
    case 'mission_cancelled':
      return 'cancelled';
    default:
      return current;
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
