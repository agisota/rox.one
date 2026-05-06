import { z } from 'zod/v4';

import {
  AgentPackageSchema,
  ExperienceLayerSchema,
  MissionCheckpointSchema,
  MissionGateResultSchema,
  MissionRunSchema,
  MetricSnapshotSchema,
  ProgressLedgerSchema,
  QuestProgressSchema,
  projectExperienceLayerView,
  type ExperienceLayer,
} from './experience-layer';
import type { ValidationGate } from './product-mode-registry';

const EvidenceRefSchema = z.string().min(1);

export const ExperienceTruthStateSchema = z
  .object({
    mission: MissionRunSchema,
    checkpoints: z.array(MissionCheckpointSchema).default([]),
    gateResults: z.array(MissionGateResultSchema).default([]),
    metricSnapshots: z.array(MetricSnapshotSchema).default([]),
    questProgress: z.array(QuestProgressSchema).default([]),
    ledger: z.array(ProgressLedgerSchema).default([]),
    agentPackages: z.array(AgentPackageSchema).default([]),
    installedAgentPackageIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((state, ctx) => {
    for (const [index, checkpoint] of state.checkpoints.entries()) {
      if (checkpoint.missionRunId !== state.mission.id) {
        ctx.addIssue({
          code: 'custom',
          message: 'Experience truth checkpoints must belong to the mission',
          path: ['checkpoints', index, 'missionRunId'],
        });
      }
    }

    for (const [index, snapshot] of state.metricSnapshots.entries()) {
      if (snapshot.missionRunId && snapshot.missionRunId !== state.mission.id) {
        ctx.addIssue({
          code: 'custom',
          message: 'Experience truth metric snapshots must belong to the mission',
          path: ['metricSnapshots', index, 'missionRunId'],
        });
      }
    }
  });

export type ExperienceTruthState = z.infer<typeof ExperienceTruthStateSchema>;

export type ExperienceTruthView = {
  layer: ExperienceLayer;
  presentationLabel: string;
  truth: {
    missionId: string;
    checkpointIds: string[];
    artifactIds: string[];
    requiredGateIds: ValidationGate[];
    evidenceRefs: string[];
    validationSemanticsMutable: false;
    ledgerSemanticsMutable: false;
  };
};

export function createExperienceTruthState(input: unknown): ExperienceTruthState {
  return ExperienceTruthStateSchema.parse(input);
}

export function projectExperienceTruthView(input: ExperienceTruthState, layer: ExperienceLayer): ExperienceTruthView {
  const truthState = ExperienceTruthStateSchema.parse(input);
  const parsedLayer = ExperienceLayerSchema.parse(layer);
  const baseView = projectExperienceLayerView(truthState.mission, parsedLayer);

  return {
    layer: parsedLayer,
    presentationLabel: baseView.presentationLabel,
    truth: {
      missionId: truthState.mission.id,
      checkpointIds: truthState.checkpoints.map((checkpoint) => checkpoint.id),
      artifactIds: uniqueSortedStrings([
        ...baseView.truth.artifactIds,
        ...truthState.checkpoints.flatMap((checkpoint) => checkpoint.artifactIds),
        ...truthState.metricSnapshots.flatMap((snapshot) => (snapshot.artifactId ? [snapshot.artifactId] : [])),
        ...truthState.ledger.flatMap((entry) => (entry.sourceArtifactId ? [entry.sourceArtifactId] : [])),
      ]),
      requiredGateIds: [...truthState.mission.requiredGateIds],
      evidenceRefs: uniqueSortedStrings([
        ...baseView.truth.artifactIds,
        ...truthState.checkpoints.flatMap((checkpoint) => checkpoint.artifactIds),
        ...truthState.gateResults.flatMap((gate) => (gate.evidenceRef ? [gate.evidenceRef] : [])),
        ...truthState.metricSnapshots.flatMap((snapshot) => snapshot.evidenceRefs),
        ...truthState.questProgress.flatMap((progress) => progress.evidenceRefs),
        ...truthState.ledger.flatMap((entry) => [
          ...(entry.sourceArtifactId ? [entry.sourceArtifactId] : []),
          ...(entry.validationGateResultId ? [entry.validationGateResultId] : []),
        ]),
      ]),
      validationSemanticsMutable: false,
      ledgerSemanticsMutable: false,
    },
  };
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => EvidenceRefSchema.parse(value)))].sort((left, right) =>
    left.localeCompare(right),
  );
}
