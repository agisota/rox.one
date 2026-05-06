import { z } from 'zod/v4';

import {
  AgentPackageSchema,
  MissionCheckpointSchema,
  MissionRunSchema,
  ProgressLedgerSchema,
  QuestProgressSchema,
  QuestSchema,
  type AgentPackage,
  type ExperienceLayer,
  type MissionCheckpoint,
  type MissionGateResult,
  type MissionRun,
  type MetricSnapshot,
  type ProgressLedger,
  type Quest,
  type QuestProgress,
} from './experience-layer';
import {
  createExperienceTruthState,
  projectExperienceTruthView,
  type ExperienceTruthState,
  type ExperienceTruthView,
} from './experience-state';
import { ValidationGateSchema, type ValidationGate } from './product-mode-registry';

const IdSchema = z.string().min(1);
const IsoDateStringSchema = z.string().min(1);
const EvidenceRefSchema = z.string().min(1).refine(
  (value) => value.startsWith('artifact:') || value.startsWith('gate:'),
  'Evidence refs must point to artifact or validation gate evidence',
);

export const ExperienceEventTypeSchema = z.enum([
  'prompt.submitted',
  'prompt.rewritten',
  'spec.compiled',
  'tdd.plan.created',
  'review.completed',
  'gate.passed',
  'gate.warned',
  'gate.failed',
  'artifact.created',
  'mission.drafted',
  'mission.launched',
  'mission.checkpoint.completed',
  'mission.blocked',
  'mission.finalized',
  'agent.package.installed',
  'agent.package.forked',
  'quest.completed',
  'reward.unlocked',
  'ledger.entry.recorded',
]);
export type ExperienceEventType = z.infer<typeof ExperienceEventTypeSchema>;

export const EXPERIENCE_EVENT_TYPES = ExperienceEventTypeSchema.options;

const ArtifactSchema = z.object({
  id: IdSchema,
  missionRunId: IdSchema.optional(),
  checkpointId: IdSchema.optional(),
  artifactType: z.string().min(1),
  title: z.string().min(1),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
  createdAt: IsoDateStringSchema,
});
export type ExperienceArtifact = z.infer<typeof ArtifactSchema>;

const RuntimeGateResultSchema = z.object({
  id: IdSchema,
  missionRunId: IdSchema.optional(),
  gateId: ValidationGateSchema,
  status: z.enum(['pass', 'warn', 'fail']),
  blocking: z.boolean().default(false),
  evidenceRef: EvidenceRefSchema,
  createdAt: IsoDateStringSchema,
});
export type RuntimeGateResult = z.infer<typeof RuntimeGateResultSchema>;

const RuntimeNotificationSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  kind: z.enum(['info', 'success', 'warning', 'error', 'reward']),
  message: z.string().min(1),
  createdAt: IsoDateStringSchema,
});
export type ExperienceNotification = z.infer<typeof RuntimeNotificationSchema>;

const RuntimeCapacitySchema = z.object({
  swarmSlots: z.number().int().min(0),
  maxMissionHours: z.number().min(0),
  storageQuotaBytes: z.number().int().min(0),
});
export type ExperienceRuntimeCapacity = z.infer<typeof RuntimeCapacitySchema>;

export const EXPERIENCE_QUEST_GRAPH: Quest[] = [
  {
    id: 'quest-frame-raw-prompt',
    lane: 'formulate',
    defaultLayer: 'command',
    title: 'Frame raw prompt',
    description: 'Turn the raw request into a bounded prompt artifact.',
    requirements: ['prompt.submitted event', 'artifact evidence'],
    rewards: ['20 XP'],
    unlocks: ['quest-rewrite-prompt'],
  },
  {
    id: 'quest-rewrite-prompt',
    lane: 'formulate',
    defaultLayer: 'command',
    title: 'Rewrite prompt',
    description: 'Improve the prompt into an execution-ready request.',
    requirements: ['prompt.rewritten event', 'source prompt artifact'],
    rewards: ['20 XP'],
    unlocks: ['quest-clarify-assumptions'],
  },
  {
    id: 'quest-clarify-assumptions',
    lane: 'formulate',
    defaultLayer: 'command',
    title: 'Clarify assumptions',
    description: 'Record open assumptions before execution planning.',
    requirements: ['review.completed event with evidence'],
    rewards: ['15 XP'],
    unlocks: ['quest-build-executable-spec'],
  },
  {
    id: 'quest-build-executable-spec',
    lane: 'specify',
    defaultLayer: 'game',
    title: 'Build executable spec',
    description: 'Compile a spec artifact that agents can execute.',
    requirements: ['spec.compiled event', 'spec artifact'],
    rewards: ['30 XP'],
    unlocks: ['quest-generate-tdd-plan'],
  },
  {
    id: 'quest-generate-tdd-plan',
    lane: 'specify',
    defaultLayer: 'game',
    title: 'Generate TDD plan',
    description: 'Create a red-green-verify plan before execution.',
    requirements: ['tdd.plan.created event', 'TDD artifact'],
    rewards: ['25 XP'],
    unlocks: ['quest-run-review-gate'],
  },
  {
    id: 'quest-run-review-gate',
    lane: 'verify',
    defaultLayer: 'command',
    title: 'Run Review Gate',
    description: 'Run review validation and record gate evidence.',
    requirements: ['review.completed or gate event', 'gate evidence'],
    rewards: ['25 XP'],
    unlocks: ['quest-launch-first-deep-mission'],
  },
  {
    id: 'quest-launch-first-deep-mission',
    lane: 'execute',
    defaultLayer: 'command',
    title: 'Launch first deep mission',
    description: 'Launch a durable mission through the runtime store.',
    requirements: ['mission.launched event'],
    rewards: ['Mission Control access'],
    unlocks: ['quest-complete-checkpoint-with-evidence'],
  },
  {
    id: 'quest-complete-checkpoint-with-evidence',
    lane: 'execute',
    defaultLayer: 'game',
    title: 'Complete checkpoint with evidence',
    description: 'Complete a checkpoint only after artifact or gate evidence exists.',
    requirements: ['mission.checkpoint.completed event', 'artifact or gate evidence'],
    rewards: ['40 XP'],
    unlocks: ['quest-resolve-blocker'],
  },
  {
    id: 'quest-resolve-blocker',
    lane: 'verify',
    defaultLayer: 'command',
    title: 'Resolve blocker',
    description: 'Convert a blocking gate or paused mission into verified progress.',
    requirements: ['prior blocker', 'subsequent passing gate evidence'],
    rewards: ['Risk reduction'],
    unlocks: ['quest-final-verified-deliverable'],
  },
  {
    id: 'quest-final-verified-deliverable',
    lane: 'verify',
    defaultLayer: 'command',
    title: 'Final verified deliverable',
    description: 'Finalize a mission with a final artifact and passing gate evidence.',
    requirements: ['mission.finalized event', 'final artifact', 'passing gate evidence'],
    rewards: ['VDI completion'],
    unlocks: ['quest-launch-swarm-arena'],
  },
  {
    id: 'quest-launch-swarm-arena',
    lane: 'arena',
    defaultLayer: 'arena',
    title: 'Launch swarm arena',
    description: 'Create a swarm mission draft with selected trusted agents.',
    requirements: ['swarm_arena mission', 'selected agents'],
    rewards: ['Arena branch'],
    unlocks: ['quest-install-trusted-agent-package'],
  },
  {
    id: 'quest-install-trusted-agent-package',
    lane: 'marketplace',
    defaultLayer: 'arena',
    title: 'Install trusted agent package',
    description: 'Install a package only after contract and trust checks pass.',
    requirements: ['agent.package.installed event', 'trust evidence'],
    rewards: ['Agent roster entry'],
    unlocks: ['quest-fork-package-team-registry'],
  },
  {
    id: 'quest-fork-package-team-registry',
    lane: 'team',
    defaultLayer: 'arena',
    title: 'Fork package into team registry',
    description: 'Fork a trusted package into the team registry.',
    requirements: ['agent.package.forked event', 'team evidence'],
    rewards: ['Team registry package'],
    unlocks: ['quest-share-verified-session'],
  },
  {
    id: 'quest-share-verified-session',
    lane: 'team',
    defaultLayer: 'command',
    title: 'Share verified session',
    description: 'Share only a redacted verified session bundle.',
    requirements: ['share artifact', 'redaction evidence'],
    rewards: ['Share-ready proof'],
    unlocks: [],
  },
].map((quest) => QuestSchema.parse(quest));

export const ExperienceRuntimeStateSchema = z.object({
  processedEventIds: z.array(IdSchema).default([]),
  activeMissionId: IdSchema.optional(),
  missions: z.array(MissionRunSchema).default([]),
  checkpoints: z.array(MissionCheckpointSchema).default([]),
  gateResults: z.array(RuntimeGateResultSchema).default([]),
  artifacts: z.array(ArtifactSchema).default([]),
  metricSnapshots: z.array(z.custom<MetricSnapshot>()).default([]),
  questProgress: z.array(QuestProgressSchema).default([]),
  ledger: z.array(ProgressLedgerSchema).default([]),
  agentPackages: z.array(AgentPackageSchema).default([]),
  installedAgentPackageIds: z.array(IdSchema).default([]),
  unlockedRewardIds: z.array(IdSchema).default([]),
  notifications: z.array(RuntimeNotificationSchema).default([]),
  capacity: RuntimeCapacitySchema.default({
    swarmSlots: 0,
    maxMissionHours: 0,
    storageQuotaBytes: 0,
  }),
});
export type ExperienceRuntimeState = z.infer<typeof ExperienceRuntimeStateSchema>;

const BaseEventSchema = z.object({
  id: IdSchema,
  createdAt: IsoDateStringSchema,
  actorId: IdSchema.optional(),
  aggregateId: IdSchema.optional(),
});

const ExperienceEventSchema = z.discriminatedUnion('type', [
  BaseEventSchema.extend({
    type: z.literal('prompt.submitted'),
    payload: z.object({
      artifactId: IdSchema,
      rawPrompt: z.string().min(1),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('prompt.rewritten'),
    payload: z.object({
      artifactId: IdSchema,
      sourceArtifactId: IdSchema,
      rewrittenPrompt: z.string().min(1),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('spec.compiled'),
    payload: z.object({
      artifactId: IdSchema,
      sourceArtifactId: IdSchema.optional(),
      title: z.string().min(1),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('tdd.plan.created'),
    payload: z.object({
      artifactId: IdSchema,
      sourceArtifactId: IdSchema.optional(),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('review.completed'),
    payload: z.object({
      artifactId: IdSchema.optional(),
      gateEvidenceRefs: z.array(EvidenceRefSchema).default([]),
      findingCount: z.number().int().min(0).default(0),
    }),
  }),
  BaseEventSchema.extend({
    type: z.union([z.literal('gate.passed'), z.literal('gate.warned'), z.literal('gate.failed')]),
    payload: z.object({
      missionRunId: IdSchema.optional(),
      gateId: ValidationGateSchema,
      evidenceRef: EvidenceRefSchema.optional(),
      blocking: z.boolean().optional(),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('artifact.created'),
    payload: z.object({
      artifact: ArtifactSchema,
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('mission.drafted'),
    payload: z.object({
      mission: MissionRunSchema,
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('mission.launched'),
    payload: z.object({
      mission: MissionRunSchema,
      checkpoints: z.array(MissionCheckpointSchema).default([]),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('mission.checkpoint.completed'),
    payload: z.object({
      missionRunId: IdSchema,
      checkpointId: IdSchema,
      summary: z.string().default(''),
      artifactIds: z.array(IdSchema).default([]),
      vdiDelta: z.number().default(0),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('mission.blocked'),
    payload: z.object({
      missionRunId: IdSchema,
      reason: z.string().min(1),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('mission.finalized'),
    payload: z.object({
      missionRunId: IdSchema,
      finalArtifactId: IdSchema.optional(),
      gateEvidenceRefs: z.array(EvidenceRefSchema).default([]),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('agent.package.installed'),
    payload: z.object({
      package: AgentPackageSchema,
      evidenceRefs: z.array(EvidenceRefSchema).default([]),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('agent.package.forked'),
    payload: z.object({
      sourcePackageId: IdSchema,
      package: AgentPackageSchema,
      evidenceRefs: z.array(EvidenceRefSchema).default([]),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('quest.completed'),
    payload: z.object({
      questId: IdSchema,
      userId: IdSchema.optional(),
      teamId: IdSchema.optional(),
      evidenceRefs: z.array(EvidenceRefSchema),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('reward.unlocked'),
    payload: z.object({
      rewardId: IdSchema,
      evidenceRefs: z.array(EvidenceRefSchema),
    }),
  }),
  BaseEventSchema.extend({
    type: z.literal('ledger.entry.recorded'),
    payload: z.object({
      entry: ProgressLedgerSchema,
    }),
  }),
]);
export type ExperienceEvent = z.infer<typeof ExperienceEventSchema>;

export type ExperiencePersistenceAdapter = {
  loadSnapshot(): Promise<ExperienceRuntimeState | undefined>;
  loadEvents(): Promise<ExperienceEvent[]>;
  appendEvent(event: ExperienceEvent): Promise<void>;
  saveSnapshot(state: ExperienceRuntimeState): Promise<void>;
};

export type ExperienceRuntimeStore = {
  getState(): ExperienceRuntimeState;
  dispatch(event: ExperienceEvent): Promise<ExperienceRuntimeState>;
};

export type InMemoryExperiencePersistenceAdapter = ExperiencePersistenceAdapter & {
  events: ExperienceEvent[];
  snapshots: ExperienceRuntimeState[];
};

export function createInitialExperienceRuntimeState(): ExperienceRuntimeState {
  return ExperienceRuntimeStateSchema.parse({});
}

export function replayExperienceEvents(
  events: ExperienceEvent[],
  initialState: ExperienceRuntimeState = createInitialExperienceRuntimeState(),
): ExperienceRuntimeState {
  return events.reduce((state, event) => reduceExperienceEvent(state, event), initialState);
}

export async function createExperienceRuntimeStore(input: {
  adapter: ExperiencePersistenceAdapter;
}): Promise<ExperienceRuntimeStore> {
  const snapshot = await input.adapter.loadSnapshot();
  let state = snapshot ? ExperienceRuntimeStateSchema.parse(snapshot) : replayExperienceEvents(await input.adapter.loadEvents());

  return {
    getState() {
      return cloneRuntimeState(state);
    },
    async dispatch(event: ExperienceEvent) {
      const parsedEvent = ExperienceEventSchema.parse(event);
      const nextState = reduceExperienceEvent(state, parsedEvent);
      if (nextState.processedEventIds.length === state.processedEventIds.length) {
        return cloneRuntimeState(state);
      }
      await input.adapter.appendEvent(parsedEvent);
      await input.adapter.saveSnapshot(nextState);
      state = nextState;
      return cloneRuntimeState(state);
    },
  };
}

export function createInMemoryExperiencePersistenceAdapter(
  seedEvents: ExperienceEvent[] = [],
): InMemoryExperiencePersistenceAdapter {
  const adapter: InMemoryExperiencePersistenceAdapter = {
    events: [...seedEvents],
    snapshots: [],
    async loadSnapshot() {
      return this.snapshots.at(-1);
    },
    async loadEvents() {
      return [...this.events];
    },
    async appendEvent(event) {
      this.events.push(ExperienceEventSchema.parse(event));
    },
    async saveSnapshot(state) {
      this.snapshots.push(cloneRuntimeState(state));
    },
  };

  return adapter;
}

export function selectActiveExperienceTruthState(state: ExperienceRuntimeState): ExperienceTruthState {
  const runtime = ExperienceRuntimeStateSchema.parse(state);
  const mission = runtime.missions.find((item) => item.id === runtime.activeMissionId) ?? runtime.missions.at(-1);
  if (!mission) {
    throw new Error('Experience runtime has no active mission truth');
  }

  return createExperienceTruthState({
    mission,
    checkpoints: runtime.checkpoints.filter((checkpoint) => checkpoint.missionRunId === mission.id),
    gateResults: runtime.gateResults
      .filter((gate) => !gate.missionRunId || gate.missionRunId === mission.id)
      .map(({ gateId, status, blocking, evidenceRef }) => ({ gateId, status, blocking, evidenceRef }) satisfies MissionGateResult),
    metricSnapshots: runtime.metricSnapshots.filter((snapshot) => !snapshot.missionRunId || snapshot.missionRunId === mission.id),
    questProgress: runtime.questProgress,
    ledger: runtime.ledger,
    agentPackages: runtime.agentPackages,
    installedAgentPackageIds: runtime.installedAgentPackageIds,
  });
}

export function selectExperienceRuntimeProjection(
  state: ExperienceRuntimeState,
  layer: ExperienceLayer,
): ExperienceTruthView {
  return projectExperienceTruthView(selectActiveExperienceTruthState(state), layer);
}

function reduceExperienceEvent(state: ExperienceRuntimeState, event: ExperienceEvent): ExperienceRuntimeState {
  const current = ExperienceRuntimeStateSchema.parse(state);
  const parsed = ExperienceEventSchema.parse(event);
  if (current.processedEventIds.includes(parsed.id)) return current;

  const withEvent = {
    ...current,
    processedEventIds: [...current.processedEventIds, parsed.id],
  };

  const next = reduceNewExperienceEvent(withEvent, parsed);
  const progressed = projectQuestProgress(next, parsed);
  return ExperienceRuntimeStateSchema.parse({
    ...progressed,
    metricSnapshots: projectMetricSnapshots(progressed, parsed),
  });
}

function reduceNewExperienceEvent(state: ExperienceRuntimeState, event: ExperienceEvent): ExperienceRuntimeState {
  switch (event.type) {
    case 'prompt.submitted':
      return appendArtifact(state, {
        id: event.payload.artifactId,
        artifactType: 'prompt',
        title: 'Raw prompt',
        evidenceRefs: [],
        createdAt: event.createdAt,
      }, successNotification(event, 'Prompt submitted'));
    case 'prompt.rewritten':
      return appendArtifact(state, {
        id: event.payload.artifactId,
        artifactType: 'prompt_rewrite',
        title: 'Rewritten prompt',
        evidenceRefs: [asArtifactRef(event.payload.sourceArtifactId)],
        createdAt: event.createdAt,
      }, successNotification(event, 'Prompt rewritten'));
    case 'spec.compiled':
      return appendArtifact(state, {
        id: event.payload.artifactId,
        artifactType: 'spec',
        title: event.payload.title,
        evidenceRefs: event.payload.sourceArtifactId ? [asArtifactRef(event.payload.sourceArtifactId)] : [],
        createdAt: event.createdAt,
      }, successNotification(event, 'Spec compiled'));
    case 'tdd.plan.created':
      return appendArtifact(state, {
        id: event.payload.artifactId,
        artifactType: 'tdd_plan',
        title: 'TDD plan',
        evidenceRefs: event.payload.sourceArtifactId ? [asArtifactRef(event.payload.sourceArtifactId)] : [],
        createdAt: event.createdAt,
      }, successNotification(event, 'TDD plan created'));
    case 'review.completed':
      return appendNotification(state, {
        id: `notification-${event.id}`,
        eventId: event.id,
        kind: event.payload.findingCount > 0 ? 'warning' : 'success',
        message: event.payload.findingCount > 0 ? 'Review completed with findings' : 'Review gate passed',
        createdAt: event.createdAt,
      });
    case 'artifact.created':
      return appendArtifact(state, event.payload.artifact, successNotification(event, 'Artifact accepted'));
    case 'mission.drafted':
      return appendMission(state, { ...event.payload.mission, status: 'draft' }, event, 'Mission drafted');
    case 'mission.launched':
      return appendNotification({
        ...appendMission(state, event.payload.mission, event, 'Mission launched'),
        checkpoints: upsertById(state.checkpoints, event.payload.checkpoints),
      }, successNotification(event, 'Mission launched'));
    case 'mission.checkpoint.completed':
      return appendNotification({
        ...state,
        checkpoints: state.checkpoints.map((checkpoint) =>
          checkpoint.id === event.payload.checkpointId && checkpoint.missionRunId === event.payload.missionRunId
            ? {
                ...checkpoint,
                status: 'completed',
                completedAt: event.createdAt,
                summary: event.payload.summary,
                artifactIds: uniqueSortedStrings([...checkpoint.artifactIds, ...event.payload.artifactIds]),
                vdiDelta: event.payload.vdiDelta,
              }
            : checkpoint,
        ),
      }, successNotification(event, 'Checkpoint completed'));
    case 'mission.blocked':
      return appendNotification({
        ...state,
        missions: state.missions.map((mission) =>
          mission.id === event.payload.missionRunId ? { ...mission, status: 'paused' } : mission,
        ),
      }, {
        id: `notification-${event.id}`,
        eventId: event.id,
        kind: 'error',
        message: event.payload.reason,
        createdAt: event.createdAt,
      });
    case 'mission.finalized':
      return finalizeMission(state, event);
    case 'agent.package.installed':
      if (!hasAgentPackageTrustEvidence(event.payload.evidenceRefs) || !isTrustedAgentPackage(event.payload.package)) {
        return appendNotification(state, {
          id: `notification-${event.id}`,
          eventId: event.id,
          kind: 'warning',
          message: 'Agent package install ignored without trust evidence',
          createdAt: event.createdAt,
        });
      }

      return appendNotification({
        ...state,
        agentPackages: upsertById(state.agentPackages, [event.payload.package]),
        installedAgentPackageIds: uniqueSortedStrings([...state.installedAgentPackageIds, event.payload.package.id]),
      }, successNotification(event, 'Agent package installed'));
    case 'agent.package.forked':
      if (event.payload.evidenceRefs.length === 0 || !isTrustedAgentPackage(event.payload.package)) {
        return appendNotification(state, {
          id: `notification-${event.id}`,
          eventId: event.id,
          kind: 'warning',
          message: 'Agent package fork ignored without trust evidence',
          createdAt: event.createdAt,
        });
      }

      return appendNotification({
        ...state,
        agentPackages: upsertById(state.agentPackages, [event.payload.package]),
      }, successNotification(event, 'Agent package forked'));
    case 'quest.completed':
      return completeQuestProgress(state, event);
    case 'reward.unlocked':
      return unlockReward(state, event);
    case 'ledger.entry.recorded':
      return recordLedgerEntry(state, event);
    case 'gate.passed':
    case 'gate.warned':
    case 'gate.failed':
      return recordGateResult(state, event);
  }
}

function appendMission(
  state: ExperienceRuntimeState,
  mission: MissionRun,
  event: ExperienceEvent,
  message: string,
): ExperienceRuntimeState {
  const parsedMission = MissionRunSchema.parse(mission);
  return appendNotification({
    ...state,
    activeMissionId: parsedMission.id,
    missions: upsertById(state.missions, [parsedMission]),
  }, successNotification(event, message));
}

function recordGateResult(
  state: ExperienceRuntimeState,
  event: Extract<ExperienceEvent, { type: 'gate.passed' | 'gate.warned' | 'gate.failed' }>,
): ExperienceRuntimeState {
  if (!event.payload.evidenceRef) {
    return appendNotification(state, {
      id: `notification-${event.id}`,
      eventId: event.id,
      kind: 'warning',
      message: `Gate ${event.payload.gateId} ignored without evidence`,
      createdAt: event.createdAt,
    });
  }

  const status = event.type === 'gate.passed' ? 'pass' : event.type === 'gate.warned' ? 'warn' : 'fail';
  const gate = RuntimeGateResultSchema.parse({
    id: event.payload.evidenceRef,
    missionRunId: event.payload.missionRunId,
    gateId: event.payload.gateId,
    status,
    blocking: event.payload.blocking ?? status === 'fail',
    evidenceRef: event.payload.evidenceRef,
    createdAt: event.createdAt,
  });

  return appendNotification({
    ...state,
    gateResults: upsertById(state.gateResults, [gate]),
  }, {
    id: `notification-${event.id}`,
    eventId: event.id,
    kind: status === 'fail' ? 'error' : status === 'warn' ? 'warning' : 'success',
    message: `Gate ${event.payload.gateId} ${status}`,
    createdAt: event.createdAt,
  });
}

function completeQuestProgress(
  state: ExperienceRuntimeState,
  event: Extract<ExperienceEvent, { type: 'quest.completed' }>,
): ExperienceRuntimeState {
  const progress = QuestProgressSchema.parse({
    id: `progress-${event.payload.questId}`,
    questId: event.payload.questId,
    userId: event.payload.userId,
    teamId: event.payload.teamId,
    status: 'completed',
    percent: 100,
    evidenceRefs: event.payload.evidenceRefs,
    completedAt: event.createdAt,
  });

  return appendNotification({
    ...state,
    questProgress: upsertById(state.questProgress, [progress]),
  }, successNotification(event, 'Quest completed'));
}

function unlockReward(
  state: ExperienceRuntimeState,
  event: Extract<ExperienceEvent, { type: 'reward.unlocked' }>,
): ExperienceRuntimeState {
  if (event.payload.evidenceRefs.length === 0) {
    throw new Error('Reward unlocks require artifact or validation gate evidence');
  }

  return appendNotification({
    ...state,
    unlockedRewardIds: uniqueSortedStrings([...state.unlockedRewardIds, event.payload.rewardId]),
  }, {
    id: `notification-${event.id}`,
    eventId: event.id,
    kind: 'reward',
    message: `Reward unlocked: ${event.payload.rewardId}`,
    createdAt: event.createdAt,
  });
}

function recordLedgerEntry(
  state: ExperienceRuntimeState,
  event: Extract<ExperienceEvent, { type: 'ledger.entry.recorded' }>,
): ExperienceRuntimeState {
  const entry = ProgressLedgerSchema.parse(event.payload.entry);
  const capacity = entry.eventType === 'entitlement'
    ? {
        ...state.capacity,
        swarmSlots: entry.currency === 'slots' ? Math.max(state.capacity.swarmSlots, Math.floor(entry.amount)) : state.capacity.swarmSlots,
        storageQuotaBytes: entry.currency === 'storage' ? Math.max(state.capacity.storageQuotaBytes, Math.floor(entry.amount)) : state.capacity.storageQuotaBytes,
      }
    : state.capacity;

  return appendNotification({
    ...state,
    capacity,
    ledger: upsertById(state.ledger, [entry]),
  }, successNotification(event, 'Ledger entry recorded'));
}

function finalizeMission(
  state: ExperienceRuntimeState,
  event: Extract<ExperienceEvent, { type: 'mission.finalized' }>,
): ExperienceRuntimeState {
  const hasGateEvidence = event.payload.gateEvidenceRefs.length > 0;
  const finalArtifact = event.payload.finalArtifactId
    ? state.artifacts.find((artifact) =>
        artifact.id === event.payload.finalArtifactId
        && (!artifact.missionRunId || artifact.missionRunId === event.payload.missionRunId),
      )
    : undefined;
  const hasPassingGateEvidence = event.payload.gateEvidenceRefs.some((evidenceRef) =>
    state.gateResults.some((gate) =>
      gate.evidenceRef === evidenceRef
      && gate.status === 'pass'
      && (!gate.missionRunId || gate.missionRunId === event.payload.missionRunId),
    ),
  );
  const hasBlockingFailedGate = state.gateResults.some((gate) =>
    gate.missionRunId === event.payload.missionRunId
    && gate.status === 'fail'
    && gate.blocking,
  );

  if (!event.payload.finalArtifactId || !hasGateEvidence || !finalArtifact || !hasPassingGateEvidence || hasBlockingFailedGate) {
    return appendNotification(state, {
      id: `notification-${event.id}`,
      eventId: event.id,
      kind: 'error',
      message: 'Mission finalization requires stored final artifact and passing gate evidence',
      createdAt: event.createdAt,
    });
  }

  return appendNotification({
    ...state,
    missions: state.missions.map((mission) =>
      mission.id === event.payload.missionRunId
        ? { ...mission, status: 'completed', completedAt: event.createdAt }
        : mission,
    ),
  }, successNotification(event, 'Mission finalized'));
}

function appendArtifact(
  state: ExperienceRuntimeState,
  artifact: ExperienceArtifact,
  notification: ExperienceNotification,
): ExperienceRuntimeState {
  return appendNotification({
    ...state,
    artifacts: upsertById(state.artifacts, [ArtifactSchema.parse(artifact)]),
  }, notification);
}

function appendNotification(
  state: ExperienceRuntimeState,
  notification: ExperienceNotification,
): ExperienceRuntimeState {
  return {
    ...state,
    notifications: upsertById(state.notifications, [RuntimeNotificationSchema.parse(notification)]),
  };
}

function projectMetricSnapshots(state: ExperienceRuntimeState, event: ExperienceEvent): MetricSnapshot[] {
  const evidenceRefs = uniqueSortedStrings([
    ...state.artifacts.flatMap((artifact) => [artifact.id, ...artifact.evidenceRefs.map(asArtifactRef)]),
    ...state.gateResults.map((gate) => gate.evidenceRef),
    ...state.questProgress.flatMap((progress) => progress.evidenceRefs),
  ]).filter((value) => value.startsWith('artifact:') || value.startsWith('gate:'));

  if (evidenceRefs.length === 0 || !state.activeMissionId) return state.metricSnapshots;

  const passCount = state.gateResults.filter((gate) => gate.status === 'pass').length;
  const warnCount = state.gateResults.filter((gate) => gate.status === 'warn').length;
  const failCount = state.gateResults.filter((gate) => gate.status === 'fail').length;
  const artifactScore = Math.min(100, state.artifacts.filter((artifact) => artifact.evidenceRefs.length > 0 || artifact.id.startsWith('artifact:')).length * 15);
  const gateScore = Math.min(100, passCount * 25 + warnCount * 10);
  const vdi = Math.min(100, Math.max(0, Math.floor(artifactScore * 0.45 + gateScore * 0.55 - failCount * 20)));

  const snapshot: MetricSnapshot = {
    id: `metric-${event.id}`,
    missionRunId: state.activeMissionId,
    qualityScore: Math.min(100, Math.max(0, 60 + passCount * 10 - failCount * 20)),
    executionReadiness: Math.min(100, Math.max(0, 50 + passCount * 12 + warnCount * 4 - failCount * 25)),
    verifiedDeliverableIndex: vdi,
    costEfficiency: Math.max(0, 1 + passCount - failCount),
    openRiskScore: Math.min(100, failCount * 30 + warnCount * 10),
    noiseScore: Math.min(100, Math.max(0, state.notifications.filter((notification) => notification.kind === 'warning').length * 5)),
    evidenceRefs,
    createdAt: event.createdAt,
  };

  return upsertById(state.metricSnapshots, [snapshot]);
}

function projectQuestProgress(state: ExperienceRuntimeState, event: ExperienceEvent): ExperienceRuntimeState {
  const progressByQuestId = new Map(
    EXPERIENCE_QUEST_GRAPH.map((quest, index) => [
      quest.id,
      QuestProgressSchema.parse({
        id: `progress-${quest.id}`,
        questId: quest.id,
        status: index === 0 ? 'available' : 'locked',
        percent: 0,
        evidenceRefs: [],
      }),
    ]),
  );

  for (const progress of state.questProgress) {
    progressByQuestId.set(progress.questId, QuestProgressSchema.parse(progress));
  }

  const completion = inferQuestCompletion(state, event);
  if (completion) {
    const existing = progressByQuestId.get(completion.questId);
    progressByQuestId.set(completion.questId, QuestProgressSchema.parse({
      ...existing,
      id: existing?.id ?? `progress-${completion.questId}`,
      questId: completion.questId,
      status: 'completed',
      percent: 100,
      evidenceRefs: completion.evidenceRefs,
      completedAt: event.createdAt,
    }));
  }

  const completedQuestIds = new Set(
    [...progressByQuestId.values()]
      .filter((progress) => progress.status === 'completed')
      .map((progress) => progress.questId),
  );

  for (const quest of EXPERIENCE_QUEST_GRAPH) {
    if (completedQuestIds.has(quest.id)) continue;
    const requirements = getQuestDependencies(quest.id);
    if (requirements.length === 0) continue;
    if (!requirements.every((questId) => completedQuestIds.has(questId))) continue;

    const progress = progressByQuestId.get(quest.id);
    if (progress?.status === 'locked') {
      progressByQuestId.set(quest.id, QuestProgressSchema.parse({
        ...progress,
        status: 'available',
      }));
    }
  }

  return {
    ...state,
    questProgress: [...progressByQuestId.values()],
  };
}

function inferQuestCompletion(
  state: ExperienceRuntimeState,
  event: ExperienceEvent,
): { questId: string; evidenceRefs: string[] } | undefined {
  switch (event.type) {
    case 'prompt.submitted':
      return {
        questId: 'quest-frame-raw-prompt',
        evidenceRefs: [asArtifactRef(event.payload.artifactId)],
      };
    case 'prompt.rewritten':
      return {
        questId: 'quest-rewrite-prompt',
        evidenceRefs: [asArtifactRef(event.payload.artifactId), asArtifactRef(event.payload.sourceArtifactId)],
      };
    case 'spec.compiled':
      return {
        questId: 'quest-build-executable-spec',
        evidenceRefs: [asArtifactRef(event.payload.artifactId)],
      };
    case 'tdd.plan.created':
      return {
        questId: 'quest-generate-tdd-plan',
        evidenceRefs: [asArtifactRef(event.payload.artifactId)],
      };
    case 'review.completed': {
      const evidenceRefs = event.payload.gateEvidenceRefs.length > 0
        ? event.payload.gateEvidenceRefs
        : event.payload.artifactId
          ? [asArtifactRef(event.payload.artifactId)]
          : [];
      if (evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-run-review-gate',
        evidenceRefs,
      };
    }
    case 'gate.passed':
    case 'gate.warned':
    case 'gate.failed':
      if (!event.payload.evidenceRef) return undefined;
      return {
        questId: 'quest-run-review-gate',
        evidenceRefs: [event.payload.evidenceRef],
      };
    case 'mission.launched':
      return {
        questId: event.payload.mission.mode === 'swarm_arena' ? 'quest-launch-swarm-arena' : 'quest-launch-first-deep-mission',
        evidenceRefs: [asArtifactRef(event.payload.mission.id)],
      };
    case 'mission.checkpoint.completed': {
      const artifactRefs = event.payload.artifactIds.map(asArtifactRef);
      const gateRefs = state.gateResults
        .filter((gate) => !gate.missionRunId || gate.missionRunId === event.payload.missionRunId)
        .map((gate) => gate.evidenceRef);
      const evidenceRefs = uniqueSortedStrings([...artifactRefs, ...gateRefs]);
      if (evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-complete-checkpoint-with-evidence',
        evidenceRefs,
      };
    }
    case 'mission.finalized': {
      const evidenceRefs = uniqueSortedStrings([
        ...(event.payload.finalArtifactId ? [asArtifactRef(event.payload.finalArtifactId)] : []),
        ...event.payload.gateEvidenceRefs,
      ]);
      if (evidenceRefs.length < 2) return undefined;
      return {
        questId: 'quest-final-verified-deliverable',
        evidenceRefs,
      };
    }
    case 'agent.package.installed':
      if (event.payload.evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-install-trusted-agent-package',
        evidenceRefs: event.payload.evidenceRefs,
      };
    case 'agent.package.forked':
      if (event.payload.evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-fork-package-team-registry',
        evidenceRefs: event.payload.evidenceRefs,
      };
    default:
      return undefined;
  }
}

function getQuestDependencies(questId: string): string[] {
  switch (questId) {
    case 'quest-rewrite-prompt':
      return ['quest-frame-raw-prompt'];
    case 'quest-clarify-assumptions':
      return ['quest-rewrite-prompt'];
    case 'quest-build-executable-spec':
      return ['quest-rewrite-prompt'];
    case 'quest-generate-tdd-plan':
      return ['quest-build-executable-spec'];
    case 'quest-run-review-gate':
      return ['quest-generate-tdd-plan'];
    case 'quest-launch-first-deep-mission':
      return ['quest-run-review-gate'];
    case 'quest-complete-checkpoint-with-evidence':
      return ['quest-launch-first-deep-mission'];
    case 'quest-resolve-blocker':
      return ['quest-complete-checkpoint-with-evidence'];
    case 'quest-final-verified-deliverable':
      return ['quest-complete-checkpoint-with-evidence'];
    case 'quest-launch-swarm-arena':
      return ['quest-final-verified-deliverable'];
    case 'quest-install-trusted-agent-package':
      return ['quest-launch-swarm-arena'];
    case 'quest-fork-package-team-registry':
      return ['quest-install-trusted-agent-package'];
    case 'quest-share-verified-session':
      return ['quest-fork-package-team-registry'];
    default:
      return [];
  }
}

function successNotification(event: ExperienceEvent, message: string): ExperienceNotification {
  return {
    id: `notification-${event.id}`,
    eventId: event.id,
    kind: 'success',
    message,
    createdAt: event.createdAt,
  };
}

function hasAgentPackageTrustEvidence(evidenceRefs: string[]): boolean {
  return evidenceRefs.some((ref) => ref.startsWith('gate:')) && evidenceRefs.some((ref) => ref.startsWith('artifact:'));
}

function isTrustedAgentPackage(pkg: AgentPackage): boolean {
  return pkg.trustScore >= 50 && pkg.riskLevel !== 'critical';
}

function asArtifactRef(id: string): string {
  return id.startsWith('artifact:') || id.startsWith('gate:') ? id : `artifact:${id}`;
}

function upsertById<T extends { id: string }>(items: T[], nextItems: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of nextItems) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cloneRuntimeState(state: ExperienceRuntimeState): ExperienceRuntimeState {
  return ExperienceRuntimeStateSchema.parse(structuredClone(state));
}
