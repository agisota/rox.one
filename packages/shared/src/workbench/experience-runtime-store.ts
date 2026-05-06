import { z } from 'zod/v4';

import {
  AgentPackageSchema,
  MissionCheckpointSchema,
  MissionRunSchema,
  ProgressLedgerSchema,
  QuestProgressSchema,
  type AgentPackage,
  type ExperienceLayer,
  type MissionCheckpoint,
  type MissionGateResult,
  type MissionRun,
  type MetricSnapshot,
  type ProgressLedger,
} from './experience-layer';
import {
  createExperienceTruthState,
  projectExperienceTruthView,
  type ExperienceTruthState,
  type ExperienceTruthView,
} from './experience-state';
import {
  canFinalizeMissionRun,
  normalizeMissionRunForLaunch,
} from './mission-lifecycle';
import { projectExperienceMetricSnapshots } from './experience-metric-engine';
import { projectExperienceQuestProgress } from './experience-quest-engine';
import { ValidationGateSchema, type ValidationGate } from './product-mode-registry';

export { projectExperienceMetricSnapshots } from './experience-metric-engine';
export { EXPERIENCE_QUEST_GRAPH, projectExperienceQuestProgress } from './experience-quest-engine';

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
  const progressed = projectExperienceQuestProgress(next, parsed);
  return ExperienceRuntimeStateSchema.parse({
    ...progressed,
    metricSnapshots: projectExperienceMetricSnapshots(progressed, parsed),
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
        ...appendMission(state, normalizeMissionRunForLaunch(event.payload.mission, event.createdAt), event, 'Mission launched'),
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
  const mission = state.missions.find((candidate) => candidate.id === event.payload.missionRunId);
  const finalization = mission
    ? canFinalizeMissionRun({
        mission,
        finalArtifactId: event.payload.finalArtifactId,
        gateEvidenceRefs: event.payload.gateEvidenceRefs,
        artifacts: state.artifacts,
        gateResults: state.gateResults,
      })
    : { allowed: false, reasons: ['missing_mission'] };

  if (!finalization.allowed) {
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
