import { describe, expect, it } from 'bun:test';

import { processSwarmSignals } from '../swarm-signal-processor';

describe('swarm signal processor', () => {
  it('clusters duplicate claims deterministically', () => {
    const result = processSwarmSignals({
      missionRunId: 'mission-1',
      signals: [
        createSignal('signal-1', 'agent-run-1', 'Launch plan misses security review.', ['artifact:review-a']),
        createSignal('signal-2', 'agent-run-2', ' launch plan misses security review. ', ['artifact:review-b']),
      ],
    });

    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0]?.signalIds).toEqual(['signal-1', 'signal-2']);
    expect(result.contributions).toHaveLength(1);
    expect(result.contributions[0]?.uniquenessScore).toBe(50);
  });

  it('increments XP for accepted evidence-backed contributions', () => {
    const result = processSwarmSignals({
      missionRunId: 'mission-1',
      signals: [createSignal('signal-1', 'agent-run-1', 'Add regression checklist.', ['gate:logic:passed'])],
    });

    expect(result.contributions[0]?.accepted).toBe(true);
    expect(result.ledgerEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'xp',
        amount: 10,
        currency: 'xp',
        sourceArtifactId: 'artifact:mission-1-signal-1',
      }),
    );
  });

  it('penalizes unsupported claims', () => {
    const result = processSwarmSignals({
      missionRunId: 'mission-1',
      signals: [createSignal('signal-1', 'agent-run-1', 'Unsupported market claim.', [])],
    });

    expect(result.contributions[0]?.accepted).toBe(false);
    expect(result.contributions[0]?.rejectionReason).toBe('unsupported_claim');
    expect(result.noisePenalty).toBe(10);
  });

  it('retains minority reports when evidence-backed and severe', () => {
    const result = processSwarmSignals({
      missionRunId: 'mission-1',
      signals: [
        createSignal('signal-1', 'agent-run-1', 'Most agents think launch is safe.', ['artifact:majority']),
        createSignal('signal-2', 'agent-run-2', 'Minority: billing ledger can be spoofed.', ['artifact:ledger-risk'], {
          minorityReport: true,
          severity: 'critical',
        }),
      ],
    });

    expect(result.minorityReports.map((report) => report.claim)).toEqual(['Minority: billing ledger can be spoofed.']);
    expect(result.contributions.find((contribution) => contribution.id === 'contribution-signal-2')?.accepted).toBe(true);
  });
});

function createSignal(
  id: string,
  agentRunId: string,
  claim: string,
  evidenceRefs: string[],
  patch: Partial<Parameters<typeof processSwarmSignals>[0]['signals'][number]> = {},
): Parameters<typeof processSwarmSignals>[0]['signals'][number] {
  return {
    id,
    agentRunId,
    claim,
    evidenceRefs,
    severity: 'medium',
    minorityReport: false,
    ...patch,
  };
}
