import {
  calculateVerifiedDeliverableIndex,
  evaluateMissionCompletion,
  MetricSnapshotSchema,
  ProgressLedgerSchema,
  QuestProgressSchema,
  type MetricSnapshot,
  type MissionRun,
  type MissionCompletionEvaluation,
  type MissionGateResult,
  type ProgressLedger,
  type QuestProgress,
} from './experience-layer';
import {
  createExperienceRuntimeStore,
  createInMemoryExperiencePersistenceAdapter,
  replayExperienceEvents,
  selectExperienceRuntimeProjection,
  type ExperienceEvent,
  type ExperienceRuntimeState,
} from './experience-runtime-store';
import {
  createFakeMissionSchedulerState,
  executeDueMissionCheckpoints,
  type MissionSchedulerState,
} from './mission-scheduler-adapter';
import { processSwarmSignals, type SwarmSignalProcessorResult } from './swarm-signal-processor';

export type ExperienceLayerProviderCallSummary = {
  browser: number;
  billing: number;
  llm: number;
  marketplace: number;
  shortlink?: number;
  scheduler: number;
  storage: number;
};

export type ExperienceLayerAuditEventType =
  | 'mission_launched'
  | 'checkpoint_executed'
  | 'contribution_accepted'
  | 'gate_passed'
  | 'quest_completed';

export type ExperienceLayerAuditEvent = {
  id: string;
  type: ExperienceLayerAuditEventType;
  missionRunId: string;
  evidenceRef: string;
  createdAt: string;
};

export type FakeExperienceLayerScenarioResult = {
  providerCalls: ExperienceLayerProviderCallSummary;
  schedulerState: MissionSchedulerState;
  swarmResult: SwarmSignalProcessorResult;
  gateResults: MissionGateResult[];
  completion: MissionCompletionEvaluation;
  metricSnapshot: MetricSnapshot;
  questProgress: QuestProgress;
  questLedgerEvent: ProgressLedger;
  auditEvents: ExperienceLayerAuditEvent[];
};

export type ExperienceRuntimeJourneyStep =
  | 'raw_prompt'
  | 'rewritten_prompt'
  | 'spec'
  | 'tdd_plan'
  | 'review_gate'
  | 'mission_draft'
  | 'mission_launch'
  | 'checkpoint_evidence'
  | 'vdi_update'
  | 'arena_branch'
  | 'trusted_agent_install'
  | 'team_package_fork'
  | 'final_verified_deliverable';

export type ExperienceRuntimeJourneyResult = {
  providerCalls: Required<ExperienceLayerProviderCallSummary>;
  journeySteps: ExperienceRuntimeJourneyStep[];
  finalState: ExperienceRuntimeState;
  replayedState: ExperienceRuntimeState;
  vdiBeforeEvidence: number;
  finalMetric: MetricSnapshot | undefined;
  completedQuestIds: string[];
  swarmSignalIds: string[];
  commandProjection: ReturnType<typeof selectExperienceRuntimeProjection>['truth'];
  gameProjection: ReturnType<typeof selectExperienceRuntimeProjection>['truth'];
  arenaProjection: ReturnType<typeof selectExperienceRuntimeProjection>['truth'];
};

const SCENARIO_NOW = '2026-04-30T06:00:00.000Z';
const MISSION_RUN_ID = 'mission-run-1';
const ACCEPTED_ARTIFACT_ID = 'artifact:mission-run-1-signal-1';
const PASSED_GATE_REF = 'gate:schema:passed';

export function runFakeExperienceLayerScenario(): FakeExperienceLayerScenarioResult {
  const initialSchedulerState = createFakeMissionSchedulerState();
  const schedulerState = executeDueMissionCheckpoints(initialSchedulerState, { now: SCENARIO_NOW });
  const swarmResult = processSwarmSignals({
    missionRunId: MISSION_RUN_ID,
    signals: [
      {
        id: 'signal-1',
        agentRunId: 'agent-run-architect',
        claim: 'The mission has enough evidence to produce a verified deliverable.',
        evidenceRefs: [PASSED_GATE_REF],
        severity: 'medium',
        minorityReport: false,
      },
    ],
  });
  const gateResults: MissionGateResult[] = [
    {
      gateId: 'schema',
      status: 'pass',
      blocking: true,
      evidenceRef: PASSED_GATE_REF,
    },
    {
      gateId: 'logic_check',
      status: 'pass',
      blocking: true,
      evidenceRef: 'gate:logic_check:passed',
    },
  ];
  const completion = evaluateMissionCompletion({
    missionId: MISSION_RUN_ID,
    elapsedHours: 6,
    durationHours: 24,
    finalArtifactId: ACCEPTED_ARTIFACT_ID,
    requiredGateResults: gateResults,
    criticalOpenFindings: 0,
  });
  const metricSnapshot = MetricSnapshotSchema.parse({
    id: 'metric-snapshot-e2e-1',
    missionRunId: MISSION_RUN_ID,
    artifactId: ACCEPTED_ARTIFACT_ID,
    userId: 'user-one',
    qualityScore: 86,
    executionReadiness: 84,
    verifiedDeliverableIndex: calculateVerifiedDeliverableIndex({
      qualityScore: 86,
      executionReadiness: 84,
      validationGatePassRate: 100,
      reviewResolutionRate: 90,
      artifactCompleteness: 92,
      reproducibilityAuditScore: 88,
      criticalOpenRiskPenalty: 0,
      unsupportedClaimPenalty: swarmResult.noisePenalty,
    }),
    costEfficiency: 94,
    openRiskScore: 0,
    noiseScore: swarmResult.noisePenalty,
    evidenceRefs: [ACCEPTED_ARTIFACT_ID, PASSED_GATE_REF],
    createdAt: SCENARIO_NOW,
  });
  const questProgress = QuestProgressSchema.parse({
    id: 'quest-progress-e2e-1',
    questId: 'quest-verified-mission-1',
    userId: 'user-one',
    status: 'completed',
    percent: 100,
    evidenceRefs: [ACCEPTED_ARTIFACT_ID, PASSED_GATE_REF],
    completedAt: SCENARIO_NOW,
  });
  const questLedgerEvent = ProgressLedgerSchema.parse({
    id: 'ledger-unlock-e2e-1',
    userId: 'user-one',
    eventType: 'unlock',
    amount: 1,
    currency: 'mastery',
    reason: 'Completed verified mission E2E quest.',
    validationGateResultId: PASSED_GATE_REF,
    createdAt: SCENARIO_NOW,
  });

  return {
    providerCalls: {
      browser: 0,
      billing: 0,
      llm: 0,
      marketplace: 0,
      scheduler: 0,
      storage: 0,
    },
    schedulerState,
    swarmResult,
    gateResults,
    completion,
    metricSnapshot,
    questProgress,
    questLedgerEvent,
    auditEvents: [
      createAuditEvent('audit-mission-launched', 'mission_launched', 'artifact:mission-draft'),
      createAuditEvent('audit-checkpoint-executed', 'checkpoint_executed', 'event-mission-run-1-cp-6h-executed'),
      createAuditEvent('audit-contribution-accepted', 'contribution_accepted', ACCEPTED_ARTIFACT_ID),
      createAuditEvent('audit-gate-passed', 'gate_passed', PASSED_GATE_REF),
      createAuditEvent('audit-quest-completed', 'quest_completed', 'ledger-unlock-e2e-1'),
    ],
  };
}

export async function runExperienceRuntimeJourneyScenario(): Promise<ExperienceRuntimeJourneyResult> {
  const adapter = createInMemoryExperiencePersistenceAdapter();
  const store = await createExperienceRuntimeStore({ adapter });
  const journeySteps: ExperienceRuntimeJourneyStep[] = [];
  const vdiBeforeEvidence = latestVdi(store.getState());

  await dispatch(store, journeySteps, 'raw_prompt', {
    id: 'event-e2e-001-raw-prompt',
    type: 'prompt.submitted',
    createdAt: '2026-05-06T08:00:00.000Z',
    actorId: 'user-one',
    payload: {
      artifactId: 'artifact-e2e-raw-prompt',
      rawPrompt: 'Нужно подготовить проверяемый запуск ROX ONE.',
    },
  });
  await dispatch(store, journeySteps, 'rewritten_prompt', {
    id: 'event-e2e-002-rewritten-prompt',
    type: 'prompt.rewritten',
    createdAt: '2026-05-06T08:01:00.000Z',
    actorId: 'user-one',
    payload: {
      artifactId: 'artifact-e2e-rewritten-prompt',
      sourceArtifactId: 'artifact-e2e-raw-prompt',
      rewrittenPrompt: 'Собрать spec, TDD план, review gate и fake-provider mission proof.',
    },
  });
  await dispatch(store, journeySteps, 'spec', {
    id: 'event-e2e-003-spec',
    type: 'spec.compiled',
    createdAt: '2026-05-06T08:02:00.000Z',
    actorId: 'user-one',
    payload: {
      artifactId: 'artifact-e2e-spec',
      sourceArtifactId: 'artifact-e2e-rewritten-prompt',
      title: 'ROX ONE executable release spec',
    },
  });
  await dispatch(store, journeySteps, 'tdd_plan', {
    id: 'event-e2e-004-tdd-plan',
    type: 'tdd.plan.created',
    createdAt: '2026-05-06T08:03:00.000Z',
    actorId: 'user-one',
    payload: {
      artifactId: 'artifact-e2e-tdd-plan',
      sourceArtifactId: 'artifact-e2e-spec',
    },
  });
  await dispatch(store, journeySteps, 'review_gate', {
    id: 'event-e2e-005-review',
    type: 'review.completed',
    createdAt: '2026-05-06T08:04:00.000Z',
    actorId: 'user-one',
    payload: {
      artifactId: 'artifact-e2e-review',
      gateEvidenceRefs: ['gate:e2e-review-warn'],
      findingCount: 1,
    },
  });
  await store.dispatch({
    id: 'event-e2e-006-review-warn',
    type: 'gate.warned',
    createdAt: '2026-05-06T08:05:00.000Z',
    actorId: 'user-one',
    payload: {
      gateId: 'logic_check',
      evidenceRef: 'gate:e2e-review-warn',
      blocking: false,
    },
  });

  const deepMission: MissionRun = {
    id: 'mission-run-e2e-deep-24h',
    ownerUserId: 'user-one',
    teamId: 'team-one',
    workspaceId: 'workspace-one',
    sourceArtifactId: 'artifact-e2e-tdd-plan',
    mode: 'deep_run' as const,
    experienceLayer: 'command' as const,
    title: '24h fake-provider release mission',
    objective: 'Produce a verified release candidate evidence bundle.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status: 'draft' as const,
    vdiTarget: 85,
    budgetCapCredits: 120,
    tokenCap: 200_000,
    storageCapBytes: 2_147_483_648,
    selectedAgentPackageIds: [],
    requiredGateIds: ['schema', 'logic_check', 'security_check'],
    createdAt: '2026-05-06T08:06:00.000Z',
  };
  const checkpoint = {
    id: 'checkpoint-e2e-6h',
    missionRunId: deepMission.id,
    ordinal: 1,
    dueAt: '2026-05-06T14:06:00.000Z',
    title: '6h evidence checkpoint',
    summary: '',
    artifactIds: [],
    vdiDelta: 0,
    status: 'queued' as const,
  };

  await dispatch(store, journeySteps, 'mission_draft', {
    id: 'event-e2e-007-mission-draft',
    type: 'mission.drafted',
    createdAt: '2026-05-06T08:06:00.000Z',
    actorId: 'user-one',
    payload: {
      mission: deepMission,
    },
  });
  await dispatch(store, journeySteps, 'mission_launch', {
    id: 'event-e2e-008-mission-launch',
    type: 'mission.launched',
    createdAt: '2026-05-06T08:07:00.000Z',
    actorId: 'user-one',
    payload: {
      mission: {
        ...deepMission,
        status: 'running',
        startedAt: '2026-05-06T08:07:00.000Z',
      },
      checkpoints: [checkpoint],
    },
  });

  await store.dispatch({
    id: 'event-e2e-009-checkpoint-artifact',
    type: 'artifact.created',
    createdAt: '2026-05-06T14:07:00.000Z',
    actorId: 'fake-provider',
    payload: {
      artifact: {
        id: 'artifact-e2e-checkpoint-1',
        missionRunId: deepMission.id,
        checkpointId: checkpoint.id,
        artifactType: 'report',
        title: '6h checkpoint evidence',
        evidenceRefs: ['gate:e2e-schema-pass'],
        createdAt: '2026-05-06T14:07:00.000Z',
      },
    },
  });
  await store.dispatch({
    id: 'event-e2e-010-schema-pass',
    type: 'gate.passed',
    createdAt: '2026-05-06T14:08:00.000Z',
    actorId: 'fake-provider',
    payload: {
      missionRunId: deepMission.id,
      gateId: 'schema',
      evidenceRef: 'gate:e2e-schema-pass',
      blocking: true,
    },
  });
  await dispatch(store, journeySteps, 'checkpoint_evidence', {
    id: 'event-e2e-011-checkpoint-complete',
    type: 'mission.checkpoint.completed',
    createdAt: '2026-05-06T14:09:00.000Z',
    actorId: 'fake-scheduler',
    payload: {
      missionRunId: deepMission.id,
      checkpointId: checkpoint.id,
      summary: 'Checkpoint produced schema-validated evidence.',
      artifactIds: ['artifact-e2e-checkpoint-1'],
      vdiDelta: 28,
    },
  });
  await store.dispatch({
    id: 'event-e2e-012-final-artifact',
    type: 'artifact.created',
    createdAt: '2026-05-06T20:00:00.000Z',
    actorId: 'fake-provider',
    payload: {
      artifact: {
        id: 'artifact-e2e-final',
        missionRunId: deepMission.id,
        artifactType: 'report',
        title: 'Final verified deliverable',
        evidenceRefs: ['artifact:artifact-e2e-checkpoint-1', 'gate:e2e-final-pass'],
        createdAt: '2026-05-06T20:00:00.000Z',
      },
    },
  });
  await dispatch(store, journeySteps, 'vdi_update', {
    id: 'event-e2e-013-final-gate-pass',
    type: 'gate.passed',
    createdAt: '2026-05-06T20:01:00.000Z',
    actorId: 'fake-provider',
    payload: {
      missionRunId: deepMission.id,
      gateId: 'logic_check',
      evidenceRef: 'gate:e2e-final-pass',
      blocking: true,
    },
  });
  const swarmResult = processSwarmSignals({
    missionRunId: 'mission-run-e2e-swarm-arena',
    signals: [
      {
        id: 'swarm-signal-architect',
        agentRunId: 'agent-run-architect',
        claim: 'The selected swarm covers planning, validation, and release evidence.',
        evidenceRefs: ['gate:e2e-final-pass'],
        severity: 'medium',
        minorityReport: false,
      },
      {
        id: 'swarm-signal-architect-duplicate',
        agentRunId: 'agent-run-reviewer',
        claim: 'The selected swarm covers planning, validation, and release evidence.',
        evidenceRefs: ['gate:e2e-final-pass'],
        severity: 'medium',
        minorityReport: false,
      },
    ],
  });

  await dispatch(store, journeySteps, 'arena_branch', {
    id: 'event-e2e-015-swarm-launch',
    type: 'mission.launched',
    createdAt: '2026-05-06T20:03:00.000Z',
    actorId: 'user-one',
    payload: {
      mission: {
        ...deepMission,
        id: 'mission-run-e2e-swarm-arena',
        mode: 'swarm_arena',
        experienceLayer: 'arena',
        title: 'Swarm arena branch',
        objective: 'Validate selected trusted agents for release evidence coverage.',
        status: 'running',
        selectedAgentPackageIds: ['agent-package-trusted-reviewer'],
        startedAt: '2026-05-06T20:03:00.000Z',
      },
      checkpoints: [],
    },
  });

  const trustedPackage = {
    id: 'agent-package-trusted-reviewer',
    packageType: 'review_pack' as const,
    name: 'Trusted Release Reviewer',
    description: 'Checks release evidence without external provider calls.',
    ownerTeamId: 'team-one',
    visibility: 'team' as const,
    rarity: 'rare' as const,
    trustScore: 88,
    riskLevel: 'low' as const,
    permissionProfileId: 'permission-readonly-review',
    latestVersion: '1.0.0',
    pricingModel: 'included',
    createdAt: '2026-05-06T20:04:00.000Z',
    updatedAt: '2026-05-06T20:04:00.000Z',
  };
  await dispatch(store, journeySteps, 'trusted_agent_install', {
    id: 'event-e2e-016-agent-install',
    type: 'agent.package.installed',
    createdAt: '2026-05-06T20:04:00.000Z',
    actorId: 'user-one',
    payload: {
      package: trustedPackage,
      evidenceRefs: ['artifact:artifact-e2e-final', 'gate:e2e-final-pass'],
    },
  });
  await dispatch(store, journeySteps, 'team_package_fork', {
    id: 'event-e2e-017-agent-fork',
    type: 'agent.package.forked',
    createdAt: '2026-05-06T20:05:00.000Z',
    actorId: 'user-one',
    payload: {
      sourcePackageId: trustedPackage.id,
      package: {
        ...trustedPackage,
        id: 'agent-package-team-release-reviewer',
        name: 'Team Release Reviewer',
        visibility: 'team',
        updatedAt: '2026-05-06T20:05:00.000Z',
      },
      evidenceRefs: ['artifact:artifact-e2e-final', 'gate:e2e-final-pass'],
    },
  });
  await dispatch(store, journeySteps, 'final_verified_deliverable', {
    id: 'event-e2e-014-finalize',
    type: 'mission.finalized',
    createdAt: '2026-05-06T20:06:00.000Z',
    actorId: 'fake-provider',
    payload: {
      missionRunId: deepMission.id,
      finalArtifactId: 'artifact-e2e-final',
      gateEvidenceRefs: ['gate:e2e-final-pass'],
    },
  });

  const finalState = store.getState();
  const commandProjection = selectExperienceRuntimeProjection(finalState, 'command').truth;
  const gameProjection = selectExperienceRuntimeProjection(finalState, 'game').truth;
  const arenaProjection = selectExperienceRuntimeProjection(finalState, 'arena').truth;

  return {
    providerCalls: {
      browser: 0,
      billing: 0,
      llm: 0,
      marketplace: 0,
      scheduler: 0,
      shortlink: 0,
      storage: 0,
    },
    journeySteps,
    finalState,
    replayedState: replayExperienceEvents(adapter.events),
    vdiBeforeEvidence,
    finalMetric: finalState.metricSnapshots.at(-1),
    completedQuestIds: finalState.questProgress
      .filter((progress) => progress.status === 'completed')
      .map((progress) => progress.questId),
    swarmSignalIds: swarmResult.clusters.map((cluster) => cluster.representativeSignalId),
    commandProjection,
    gameProjection,
    arenaProjection,
  };
}

async function dispatch(
  store: Awaited<ReturnType<typeof createExperienceRuntimeStore>>,
  steps: ExperienceRuntimeJourneyStep[],
  step: ExperienceRuntimeJourneyStep,
  event: ExperienceEvent,
): Promise<void> {
  await store.dispatch(event);
  steps.push(step);
}

function latestVdi(state: ExperienceRuntimeState): number {
  return state.metricSnapshots.at(-1)?.verifiedDeliverableIndex ?? 0;
}

function createAuditEvent(
  id: string,
  type: ExperienceLayerAuditEventType,
  evidenceRef: string,
): ExperienceLayerAuditEvent {
  return {
    id,
    type,
    missionRunId: MISSION_RUN_ID,
    evidenceRef,
    createdAt: SCENARIO_NOW,
  };
}
