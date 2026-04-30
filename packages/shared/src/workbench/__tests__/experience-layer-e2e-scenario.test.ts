import { describe, expect, it } from 'bun:test';

import { runFakeExperienceLayerScenario } from '../experience-layer-e2e-scenario';

describe('experience layer e2e scenario', () => {
  it('does not call real external providers', () => {
    const result = runFakeExperienceLayerScenario();

    expect(result.providerCalls).toEqual({
      browser: 0,
      billing: 0,
      llm: 0,
      marketplace: 0,
      scheduler: 0,
      storage: 0,
    });
  });

  it('advances a checkpoint through a deterministic fake scheduler', () => {
    const first = runFakeExperienceLayerScenario();
    const second = runFakeExperienceLayerScenario();

    expect(first.schedulerState.events).toEqual(second.schedulerState.events);
    expect(first.schedulerState.events).toContainEqual(
      expect.objectContaining({
        id: 'event-mission-run-1-cp-6h-executed',
        checkpointId: 'cp-6h',
        type: 'checkpoint_executed',
      }),
    );
    expect(first.schedulerState.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('completed');
  });

  it('records audit and ledger evidence across launch, checkpoint, contribution, gate, and quest events', () => {
    const result = runFakeExperienceLayerScenario();

    expect(result.auditEvents.map((event) => event.type)).toEqual([
      'mission_launched',
      'checkpoint_executed',
      'contribution_accepted',
      'gate_passed',
      'quest_completed',
    ]);
    expect(result.swarmResult.ledgerEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'xp',
        currency: 'xp',
        sourceArtifactId: 'artifact:mission-run-1-signal-1',
      }),
    );
    expect(result.questLedgerEvent).toEqual(
      expect.objectContaining({
        eventType: 'unlock',
        validationGateResultId: 'gate:schema:passed',
      }),
    );
  });

  it('passes validation gates, improves VDI, and completes quest progress from evidence only', () => {
    const result = runFakeExperienceLayerScenario();

    expect(result.completion.decision).toBe('pass');
    expect(result.metricSnapshot.verifiedDeliverableIndex).toBeGreaterThanOrEqual(80);
    expect(result.questProgress).toEqual(
      expect.objectContaining({
        status: 'completed',
        percent: 100,
        evidenceRefs: ['artifact:mission-run-1-signal-1', 'gate:schema:passed'],
      }),
    );
  });
});
