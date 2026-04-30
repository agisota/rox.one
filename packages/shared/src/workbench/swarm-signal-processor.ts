import type {
  Contribution,
  ContributionSeverity,
  ProgressLedger,
} from './experience-layer';

export type SwarmSignal = {
  id: string;
  agentRunId: string;
  claim: string;
  evidenceRefs: string[];
  severity: ContributionSeverity;
  minorityReport: boolean;
};

export type SwarmSignalCluster = {
  id: string;
  normalizedClaim: string;
  signalIds: string[];
  representativeSignalId: string;
};

export type SwarmMinorityReport = {
  signalId: string;
  claim: string;
  severity: ContributionSeverity;
  evidenceRefs: string[];
};

export type SwarmSignalProcessorInput = {
  missionRunId: string;
  signals: SwarmSignal[];
};

export type SwarmSignalProcessorResult = {
  clusters: SwarmSignalCluster[];
  contributions: Contribution[];
  ledgerEvents: ProgressLedger[];
  minorityReports: SwarmMinorityReport[];
  noisePenalty: number;
};

const UNSUPPORTED_CLAIM_PENALTY = 10;

export function processSwarmSignals(input: SwarmSignalProcessorInput): SwarmSignalProcessorResult {
  const clusters = createClusters(input.signals);
  const contributions: Contribution[] = [];
  const ledgerEvents: ProgressLedger[] = [];
  const minorityReports: SwarmMinorityReport[] = [];
  let noisePenalty = 0;

  for (const cluster of clusters) {
    const representative = input.signals.find((signal) => signal.id === cluster.representativeSignalId);
    if (!representative) continue;

    const accepted = representative.evidenceRefs.length > 0;
    if (!accepted) noisePenalty += UNSUPPORTED_CLAIM_PENALTY;

    const resultingArtifactId = accepted ? `artifact:${input.missionRunId}-${representative.id}` : undefined;
    contributions.push({
      id: `contribution-${representative.id}`,
      agentRunId: representative.agentRunId,
      claim: representative.claim.trim(),
      evidenceRefs: representative.evidenceRefs,
      uniquenessScore: Math.round(100 / cluster.signalIds.length),
      severity: representative.severity,
      accepted,
      rejectionReason: accepted ? undefined : 'unsupported_claim',
      resultingArtifactId,
    });

    if (accepted && resultingArtifactId) {
      ledgerEvents.push({
        id: `ledger-xp-${representative.id}`,
        eventType: 'xp',
        amount: calculateXpAmount(representative.severity),
        currency: 'xp',
        reason: `Accepted swarm contribution: ${representative.claim.trim()}`,
        sourceArtifactId: resultingArtifactId,
        createdAt: '2026-04-30T00:00:00.000Z',
      });
    }

    if (accepted && representative.minorityReport && isSevereMinorityReport(representative.severity)) {
      minorityReports.push({
        signalId: representative.id,
        claim: representative.claim.trim(),
        severity: representative.severity,
        evidenceRefs: representative.evidenceRefs,
      });
    }
  }

  return {
    clusters,
    contributions,
    ledgerEvents,
    minorityReports,
    noisePenalty,
  };
}

function createClusters(signals: SwarmSignal[]): SwarmSignalCluster[] {
  const clustersByClaim = new Map<string, SwarmSignalCluster>();

  for (const signal of signals) {
    const normalizedClaim = normalizeClaim(signal.claim);
    const existing = clustersByClaim.get(normalizedClaim);

    if (existing) {
      existing.signalIds.push(signal.id);
      continue;
    }

    clustersByClaim.set(normalizedClaim, {
      id: `cluster-${clustersByClaim.size + 1}`,
      normalizedClaim,
      signalIds: [signal.id],
      representativeSignalId: signal.id,
    });
  }

  return [...clustersByClaim.values()];
}

function normalizeClaim(claim: string): string {
  return claim.trim().replace(/\s+/g, ' ').toLowerCase();
}

function calculateXpAmount(severity: ContributionSeverity): number {
  if (severity === 'critical') return 25;
  if (severity === 'high') return 18;
  return 10;
}

function isSevereMinorityReport(severity: ContributionSeverity): boolean {
  return severity === 'high' || severity === 'critical';
}
