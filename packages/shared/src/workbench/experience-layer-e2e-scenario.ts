import {
  calculateVerifiedDeliverableIndex,
  evaluateMissionCompletion,
  MetricSnapshotSchema,
  ProgressLedgerSchema,
  QuestProgressSchema,
  type MetricSnapshot,
  type MissionCompletionEvaluation,
  type MissionGateResult,
  type ProgressLedger,
  type QuestProgress,
} from './experience-layer';
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
