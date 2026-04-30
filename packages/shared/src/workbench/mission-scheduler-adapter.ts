import type {
  MissionCheckpoint,
  MissionCheckpointStatus,
  MissionRun,
  MissionRunStatus,
} from './experience-layer';

export type MissionRunEventType = 'checkpoint_executed' | 'budget_exhausted';

export type MissionRunEvent = {
  id: string;
  missionRunId: string;
  checkpointId: string;
  type: MissionRunEventType;
  summary: string;
  createdAt: string;
  costCredits: number;
};

export type MissionSchedulerState = {
  missions: MissionRun[];
  checkpoints: MissionCheckpoint[];
  budgetRemainingCreditsByMissionId: Record<string, number>;
  executedIdempotencyKeys: string[];
  events: MissionRunEvent[];
};

export type FakeMissionSchedulerStateInput = {
  missionStatus?: MissionRunStatus;
  budgetRemainingCreditsByMissionId?: Record<string, number>;
};

export type MissionSchedulerTickInput = {
  now: string;
  checkpointCostCredits?: number;
};

const DEFAULT_CHECKPOINT_COST_CREDITS = 12;

export function createFakeMissionSchedulerState(input: FakeMissionSchedulerStateInput = {}): MissionSchedulerState {
  return {
    missions: [createMissionRun(input.missionStatus ?? 'running')],
    checkpoints: createCheckpoints(),
    budgetRemainingCreditsByMissionId: input.budgetRemainingCreditsByMissionId ?? {
      'mission-run-1': 100,
    },
    executedIdempotencyKeys: [],
    events: [],
  };
}

export function executeDueMissionCheckpoints(
  state: MissionSchedulerState,
  input: MissionSchedulerTickInput,
): MissionSchedulerState {
  const checkpointCostCredits = input.checkpointCostCredits ?? DEFAULT_CHECKPOINT_COST_CREDITS;
  let next = cloneState(state);

  for (const checkpoint of state.checkpoints) {
    const mission = next.missions.find((item) => item.id === checkpoint.missionRunId);
    if (!mission || mission.status === 'cancelled' || mission.status !== 'running') continue;
    if (checkpoint.status !== 'queued') continue;
    if (!isDue(checkpoint.dueAt, input.now)) continue;

    const idempotencyKey = `${checkpoint.missionRunId}:${checkpoint.id}`;
    if (next.executedIdempotencyKeys.includes(idempotencyKey)) continue;

    const remainingBudget = next.budgetRemainingCreditsByMissionId[checkpoint.missionRunId] ?? 0;
    if (remainingBudget < checkpointCostCredits) {
      next = updateMissionStatus(next, mission.id, 'paused');
      next = updateCheckpointStatus(next, checkpoint.id, 'blocked');
      next.events = next.events.concat(
        createEvent({
          checkpoint,
          type: 'budget_exhausted',
          summary: `Budget exhausted before ${checkpoint.title}.`,
          costCredits: 0,
          createdAt: input.now,
        }),
      );
      continue;
    }

    next.budgetRemainingCreditsByMissionId = {
      ...next.budgetRemainingCreditsByMissionId,
      [checkpoint.missionRunId]: remainingBudget - checkpointCostCredits,
    };
    next.executedIdempotencyKeys = next.executedIdempotencyKeys.concat(idempotencyKey);
    next = updateCheckpointStatus(next, checkpoint.id, 'completed');
    next.events = next.events.concat(
      createEvent({
        checkpoint,
        type: 'checkpoint_executed',
        summary: `Executed ${checkpoint.title}.`,
        costCredits: checkpointCostCredits,
        createdAt: input.now,
      }),
    );
  }

  return next;
}

function createMissionRun(status: MissionRunStatus): MissionRun {
  return {
    id: 'mission-run-1',
    ownerUserId: 'user-one',
    workspaceId: 'workspace-main',
    mode: 'deep_run',
    experienceLayer: 'command',
    title: '24h fake scheduler run',
    objective: 'Verify deterministic checkpoint execution.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status,
    vdiTarget: 80,
    budgetCapCredits: 100,
    tokenCap: 1_000_000,
    storageCapBytes: 1_073_741_824,
    selectedAgentPackageIds: ['agent-architect'],
    requiredGateIds: ['schema', 'logic_check'],
    createdAt: '2026-04-30T00:00:00.000Z',
    startedAt: '2026-04-30T00:00:00.000Z',
  };
}

function createCheckpoints(): MissionCheckpoint[] {
  return [
    createCheckpoint('cp-6h', 1, 'Checkpoint 6h'),
    createCheckpoint('cp-12h', 2, 'Checkpoint 12h'),
    createCheckpoint('cp-18h', 3, 'Checkpoint 18h'),
    createCheckpoint('cp-24h', 4, 'Final verification'),
  ];
}

function createCheckpoint(id: string, ordinal: number, title: string): MissionCheckpoint {
  return {
    id,
    missionRunId: 'mission-run-1',
    ordinal,
    dueAt: `2026-04-30T${String(ordinal * 6).padStart(2, '0')}:00:00.000Z`,
    title,
    summary: '',
    artifactIds: [],
    vdiDelta: 0,
    status: 'queued',
  };
}

function createEvent(input: {
  checkpoint: MissionCheckpoint;
  type: MissionRunEventType;
  summary: string;
  costCredits: number;
  createdAt: string;
}): MissionRunEvent {
  return {
    id: `event-${input.checkpoint.missionRunId}-${input.checkpoint.id}-${eventSuffix(input.type)}`,
    missionRunId: input.checkpoint.missionRunId,
    checkpointId: input.checkpoint.id,
    type: input.type,
    summary: input.summary,
    createdAt: input.createdAt,
    costCredits: input.costCredits,
  };
}

function eventSuffix(type: MissionRunEventType): string {
  return type === 'checkpoint_executed' ? 'executed' : 'budget-exhausted';
}

function updateCheckpointStatus(
  state: MissionSchedulerState,
  checkpointId: string,
  status: MissionCheckpointStatus,
): MissionSchedulerState {
  return {
    ...state,
    checkpoints: state.checkpoints.map((checkpoint) =>
      checkpoint.id === checkpointId ? { ...checkpoint, status } : checkpoint,
    ),
  };
}

function updateMissionStatus(
  state: MissionSchedulerState,
  missionId: string,
  status: MissionRunStatus,
): MissionSchedulerState {
  return {
    ...state,
    missions: state.missions.map((mission) => (mission.id === missionId ? { ...mission, status } : mission)),
  };
}

function cloneState(state: MissionSchedulerState): MissionSchedulerState {
  return {
    missions: state.missions.map((mission) => ({ ...mission })),
    checkpoints: state.checkpoints.map((checkpoint) => ({ ...checkpoint })),
    budgetRemainingCreditsByMissionId: { ...state.budgetRemainingCreditsByMissionId },
    executedIdempotencyKeys: [...state.executedIdempotencyKeys],
    events: [...state.events],
  };
}

function isDue(dueAt: string, now: string): boolean {
  return Date.parse(dueAt) <= Date.parse(now);
}
