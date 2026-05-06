import type {
  ExperienceEvent,
  ExperienceLayer,
  ExperienceRuntimeStore,
  ExperienceTruthState,
  MissionCheckpoint,
  MissionMode,
  MissionRun,
} from '@craft-agent/shared/workbench';

export type DeepMissionPresetId = 'sprint_6h' | 'deep_run_24h' | 'watchtower_72h';
export type DeepMissionFormStatus = 'empty' | 'invalid' | 'ready' | 'launching' | 'launched' | 'blocked' | 'failed';

export type DeepMissionPreset = {
  id: DeepMissionPresetId;
  label: string;
  description: string;
  durationHours: number;
  checkpointCadenceHours: number;
  mode: MissionMode;
  recommendedAgentCount: number;
};

export type CheckpointPreviewItem = {
  ordinal: number;
  hour: number;
  title: string;
};

export type DeepMissionEntryStateInput = {
  rawInput?: string;
  title?: string;
  objective?: string;
  presetId?: DeepMissionPresetId;
  mode?: MissionMode;
  experienceLayer?: ExperienceLayer;
  durationHours?: number;
  checkpointCadenceHours?: number;
  budgetCapCredits?: number;
  tokenCap?: number;
  storageCapBytes?: number;
  selectedAgentCount?: number;
  vdiTarget?: number;
};

export type DeepMissionEntryState = {
  rawInput: string;
  title: string;
  objective: string;
  presetId: DeepMissionPresetId;
  mode: MissionMode;
  experienceLayer: ExperienceLayer;
  durationHours: number;
  checkpointCadenceHours: number;
  budgetCapCredits: number;
  tokenCap: number;
  storageCapBytes: number;
  selectedAgentCount: number;
  vdiTarget: number;
  status: DeepMissionFormStatus;
  checkpointPreview: CheckpointPreviewItem[];
  validationErrors: string[];
  canLaunch: boolean;
};

export type DeepMissionDraftPersistenceAdapter = {
  saveDraft(state: DeepMissionEntryState): Promise<void>;
};

export type DeepMissionSchedulerAdapter = {
  launchMission(input: {
    mission: MissionRun;
    checkpoints: MissionCheckpoint[];
    idempotencyKey: string;
  }): Promise<void>;
};

export type FakeDeepMissionDraftPersistenceAdapter = DeepMissionDraftPersistenceAdapter & {
  savedDrafts: DeepMissionEntryState[];
};

export type FakeDeepMissionSchedulerAdapter = DeepMissionSchedulerAdapter & {
  launchedMissions: MissionRun[];
  launchedCheckpoints: MissionCheckpoint[][];
  idempotencyKeys: string[];
};

export type DeepMissionLaunchInput = {
  now: string;
  actorId: string;
  ownerUserId: string;
  workspaceId: string;
  teamId?: string;
  draftPersistence: DeepMissionDraftPersistenceAdapter;
  scheduler: DeepMissionSchedulerAdapter;
  runtimeStore: ExperienceRuntimeStore;
};

export type DeepMissionLaunchPlan = {
  status: DeepMissionFormStatus;
  mission: MissionRun;
  checkpoints: MissionCheckpoint[];
  events: ExperienceEvent[];
};

export const DEEP_MISSION_PRESETS: DeepMissionPreset[] = [
  {
    id: 'sprint_6h',
    label: '6h Sprint',
    description: 'A focused short run for early contradictions and blocker discovery.',
    durationHours: 6,
    checkpointCadenceHours: 3,
    mode: 'deep_reasoning_lab',
    recommendedAgentCount: 5,
  },
  {
    id: 'deep_run_24h',
    label: '24h Deep Run',
    description: 'The default deep mission with 6h checkpoints and final verification.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    mode: 'deep_run',
    recommendedAgentCount: 12,
  },
  {
    id: 'watchtower_72h',
    label: '72h Watchtower',
    description: 'A longer proactive loop for source drift, risk watch, and periodic synthesis.',
    durationHours: 72,
    checkpointCadenceHours: 12,
    mode: 'proactive_watchtower',
    recommendedAgentCount: 18,
  },
];

export function createDeepMissionEntryState(input: DeepMissionEntryStateInput = {}): DeepMissionEntryState {
  const preset = findPreset(input.presetId ?? 'deep_run_24h');
  return buildDeepMissionEntryState({
    rawInput: input.rawInput ?? '',
    title: input.title ?? '',
    objective: input.objective ?? '',
    presetId: preset.id,
    mode: input.mode ?? preset.mode,
    experienceLayer: input.experienceLayer ?? 'command',
    durationHours: input.durationHours ?? preset.durationHours,
    checkpointCadenceHours: input.checkpointCadenceHours ?? preset.checkpointCadenceHours,
    budgetCapCredits: input.budgetCapCredits ?? 0,
    tokenCap: input.tokenCap ?? 0,
    storageCapBytes: input.storageCapBytes ?? 0,
    selectedAgentCount: input.selectedAgentCount ?? preset.recommendedAgentCount,
    vdiTarget: input.vdiTarget ?? 75,
  });
}

export function createDeepMissionEntryStateFromTruth(truthState: ExperienceTruthState): DeepMissionEntryState {
  return createDeepMissionEntryState({
    rawInput: truthState.mission.sourceArtifactId ?? truthState.mission.objective,
    title: truthState.mission.title,
    objective: truthState.mission.objective,
    mode: truthState.mission.mode,
    experienceLayer: truthState.mission.experienceLayer,
    durationHours: truthState.mission.durationHours,
    checkpointCadenceHours: truthState.mission.checkpointCadenceHours,
    budgetCapCredits: truthState.mission.budgetCapCredits,
    tokenCap: truthState.mission.tokenCap,
    storageCapBytes: truthState.mission.storageCapBytes,
    selectedAgentCount: truthState.mission.selectedAgentPackageIds.length,
    vdiTarget: truthState.mission.vdiTarget,
  });
}

export function updateDeepMissionDraft(
  state: DeepMissionEntryState,
  patch: Partial<DeepMissionEntryStateInput>,
): DeepMissionEntryState {
  return createDeepMissionEntryState({
    rawInput: patch.rawInput ?? state.rawInput,
    title: patch.title ?? state.title,
    objective: patch.objective ?? state.objective,
    presetId: patch.presetId ?? state.presetId,
    mode: patch.mode ?? state.mode,
    experienceLayer: patch.experienceLayer ?? state.experienceLayer,
    durationHours: patch.durationHours ?? state.durationHours,
    checkpointCadenceHours: patch.checkpointCadenceHours ?? state.checkpointCadenceHours,
    budgetCapCredits: patch.budgetCapCredits ?? state.budgetCapCredits,
    tokenCap: patch.tokenCap ?? state.tokenCap,
    storageCapBytes: patch.storageCapBytes ?? state.storageCapBytes,
    selectedAgentCount: patch.selectedAgentCount ?? state.selectedAgentCount,
    vdiTarget: patch.vdiTarget ?? state.vdiTarget,
  });
}

export function selectDeepMissionPreset(
  state: DeepMissionEntryState,
  presetId: DeepMissionPresetId,
): DeepMissionEntryState {
  const preset = findPreset(presetId);
  return createDeepMissionEntryState({
    ...state,
    presetId: preset.id,
    mode: preset.mode,
    durationHours: preset.durationHours,
    checkpointCadenceHours: preset.checkpointCadenceHours,
    selectedAgentCount: preset.recommendedAgentCount,
  });
}

export function createCheckpointPreview(input: {
  durationHours: number;
  checkpointCadenceHours: number;
}): CheckpointPreviewItem[] {
  if (input.durationHours <= 0 || input.checkpointCadenceHours <= 0) {
    return [];
  }

  const checkpoints: CheckpointPreviewItem[] = [];
  for (let hour = 0; hour <= input.durationHours; hour += input.checkpointCadenceHours) {
    checkpoints.push({
      ordinal: checkpoints.length,
      hour,
      title: hour === 0 ? 'Mission brief' : hour === input.durationHours ? 'Final verification' : `Checkpoint ${hour}h`,
    });
  }
  return checkpoints;
}

function buildDeepMissionEntryState(state: Omit<DeepMissionEntryState, 'checkpointPreview' | 'validationErrors' | 'canLaunch' | 'status'>): DeepMissionEntryState {
  const validationErrors = validateDeepMissionEntryState(state);
  const status = selectFormStatus(state, validationErrors);
  return {
    ...state,
    status,
    checkpointPreview: createCheckpointPreview({
      durationHours: state.durationHours,
      checkpointCadenceHours: state.checkpointCadenceHours,
    }),
    validationErrors,
    canLaunch: validationErrors.length === 0,
  };
}

function validateDeepMissionEntryState(state: Omit<DeepMissionEntryState, 'checkpointPreview' | 'validationErrors' | 'canLaunch' | 'status'>): string[] {
  const errors: string[] = [];

  if (!state.rawInput.trim()) errors.push('Raw mission input is required.');
  if (!state.title.trim()) errors.push('Mission title is required.');
  if (!state.objective.trim()) errors.push('Mission objective is required.');
  if (state.budgetCapCredits <= 0) errors.push('Budget cap is required before launch.');
  if (state.tokenCap <= 0) errors.push('Token cap is required before launch.');
  if (state.storageCapBytes <= 0) errors.push('Storage cap is required before launch.');
  if (state.selectedAgentCount <= 0) errors.push('At least one agent is required before launch.');
  if (state.durationHours <= 0) errors.push('Duration must be positive.');
  if (state.checkpointCadenceHours <= 0) errors.push('Checkpoint cadence must be positive.');
  if (state.durationHours % state.checkpointCadenceHours !== 0) {
    errors.push('Duration must divide evenly by checkpoint cadence.');
  }
  if (state.vdiTarget < 0 || state.vdiTarget > 100) errors.push('VDI target must be between 0 and 100.');

  return errors;
}

function selectFormStatus(
  state: Omit<DeepMissionEntryState, 'checkpointPreview' | 'validationErrors' | 'canLaunch' | 'status'>,
  validationErrors: string[],
): DeepMissionFormStatus {
  if (!state.rawInput.trim() && !state.title.trim() && !state.objective.trim()) {
    return 'empty';
  }
  return validationErrors.length > 0 ? 'invalid' : 'ready';
}

function findPreset(presetId: DeepMissionPresetId): DeepMissionPreset {
  return DEEP_MISSION_PRESETS.find((preset) => preset.id === presetId) ?? DEEP_MISSION_PRESETS[1];
}

export function createFakeDeepMissionDraftPersistenceAdapter(): FakeDeepMissionDraftPersistenceAdapter {
  return {
    savedDrafts: [],
    async saveDraft(state) {
      this.savedDrafts.push({ ...state, checkpointPreview: state.checkpointPreview.map((checkpoint) => ({ ...checkpoint })) });
    },
  };
}

export function createFakeDeepMissionSchedulerAdapter(): FakeDeepMissionSchedulerAdapter {
  return {
    launchedMissions: [],
    launchedCheckpoints: [],
    idempotencyKeys: [],
    async launchMission(input) {
      if (this.idempotencyKeys.includes(input.idempotencyKey)) return;
      this.idempotencyKeys.push(input.idempotencyKey);
      this.launchedMissions.push({ ...input.mission });
      this.launchedCheckpoints.push(input.checkpoints.map((checkpoint) => ({ ...checkpoint })));
    },
  };
}

export async function createDeepMissionLaunchPlan(
  state: DeepMissionEntryState,
  input: DeepMissionLaunchInput,
): Promise<DeepMissionLaunchPlan> {
  if (!state.canLaunch) {
    throw new Error(`Cannot launch deep mission while form is ${state.status}`);
  }

  await input.draftPersistence.saveDraft(state);

  const missionId = createStableId('mission', state.title, input.now);
  const draftMission = createMissionRunFromDraft(state, input, missionId, 'draft');
  const launchedMission = {
    ...draftMission,
    status: 'running',
    startedAt: input.now,
  } satisfies MissionRun;
  const checkpoints = createLaunchCheckpoints(state, missionId, input.now);
  const events: ExperienceEvent[] = [
    {
      id: `${missionId}:drafted`,
      type: 'mission.drafted',
      createdAt: input.now,
      actorId: input.actorId,
      aggregateId: missionId,
      payload: { mission: draftMission },
    },
    {
      id: `${missionId}:launched`,
      type: 'mission.launched',
      createdAt: input.now,
      actorId: input.actorId,
      aggregateId: missionId,
      payload: { mission: launchedMission, checkpoints },
    },
  ];

  for (const event of events) {
    await input.runtimeStore.dispatch(event);
  }
  await input.scheduler.launchMission({
    mission: launchedMission,
    checkpoints,
    idempotencyKey: `${missionId}:launch`,
  });

  return {
    status: 'launched',
    mission: launchedMission,
    checkpoints,
    events,
  };
}

function createMissionRunFromDraft(
  state: DeepMissionEntryState,
  input: DeepMissionLaunchInput,
  missionId: string,
  status: MissionRun['status'],
): MissionRun {
  return {
    id: missionId,
    ownerUserId: input.ownerUserId,
    teamId: input.teamId,
    workspaceId: input.workspaceId,
    sourceArtifactId: createStableId('artifact:mission-input', state.rawInput, input.now),
    mode: state.mode,
    experienceLayer: state.experienceLayer,
    title: state.title.trim(),
    objective: state.objective.trim(),
    durationHours: state.durationHours,
    checkpointCadenceHours: state.checkpointCadenceHours,
    status,
    vdiTarget: state.vdiTarget,
    budgetCapCredits: state.budgetCapCredits,
    tokenCap: state.tokenCap,
    storageCapBytes: state.storageCapBytes,
    selectedAgentPackageIds: Array.from({ length: state.selectedAgentCount }, (_, index) => `agent-${index + 1}`),
    requiredGateIds: ['schema', 'logic_check', 'security_check'],
    createdAt: input.now,
    startedAt: status === 'running' ? input.now : undefined,
  };
}

function createLaunchCheckpoints(
  state: DeepMissionEntryState,
  missionId: string,
  now: string,
): MissionCheckpoint[] {
  const startMs = Date.parse(now);
  return state.checkpointPreview
    .filter((checkpoint) => checkpoint.hour > 0)
    .map((checkpoint) => ({
      id: `${missionId}:cp-${checkpoint.hour}h`,
      missionRunId: missionId,
      ordinal: checkpoint.ordinal,
      dueAt: new Date(startMs + checkpoint.hour * 60 * 60 * 1000).toISOString(),
      title: checkpoint.title,
      summary: '',
      artifactIds: [],
      vdiDelta: 0,
      status: 'queued' as const,
    }));
}

function createStableId(prefix: string, value: string, now: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'draft';
  return `${prefix}:${slug}:${now.replace(/[^0-9]/g, '').slice(0, 14)}`;
}
