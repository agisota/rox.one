import type { ExperienceLayer, MissionMode } from '@craft-agent/shared/workbench';

export type DeepMissionPresetId = 'sprint_6h' | 'deep_run_24h' | 'watchtower_72h';

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
  checkpointPreview: CheckpointPreviewItem[];
  validationErrors: string[];
  canLaunch: boolean;
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

function buildDeepMissionEntryState(state: Omit<DeepMissionEntryState, 'checkpointPreview' | 'validationErrors' | 'canLaunch'>): DeepMissionEntryState {
  const validationErrors = validateDeepMissionEntryState(state);
  return {
    ...state,
    checkpointPreview: createCheckpointPreview({
      durationHours: state.durationHours,
      checkpointCadenceHours: state.checkpointCadenceHours,
    }),
    validationErrors,
    canLaunch: validationErrors.length === 0,
  };
}

function validateDeepMissionEntryState(state: Omit<DeepMissionEntryState, 'checkpointPreview' | 'validationErrors' | 'canLaunch'>): string[] {
  const errors: string[] = [];

  if (!state.rawInput.trim()) errors.push('Raw mission input is required.');
  if (!state.title.trim()) errors.push('Mission title is required.');
  if (!state.objective.trim()) errors.push('Mission objective is required.');
  if (state.budgetCapCredits <= 0) errors.push('Budget cap is required before launch.');
  if (state.durationHours <= 0) errors.push('Duration must be positive.');
  if (state.checkpointCadenceHours <= 0) errors.push('Checkpoint cadence must be positive.');
  if (state.durationHours % state.checkpointCadenceHours !== 0) {
    errors.push('Duration must divide evenly by checkpoint cadence.');
  }
  if (state.vdiTarget < 0 || state.vdiTarget > 100) errors.push('VDI target must be between 0 and 100.');

  return errors;
}

function findPreset(presetId: DeepMissionPresetId): DeepMissionPreset {
  return DEEP_MISSION_PRESETS.find((preset) => preset.id === presetId) ?? DEEP_MISSION_PRESETS[1];
}
