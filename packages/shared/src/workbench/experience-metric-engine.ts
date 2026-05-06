import type { MetricSnapshot } from './experience-layer';
import type { ExperienceEvent, ExperienceRuntimeState } from './experience-runtime-store';

export function projectExperienceMetricSnapshots(
  state: ExperienceRuntimeState,
  event: ExperienceEvent,
): MetricSnapshot[] {
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
