import { describe, expect, it } from 'bun:test';

import {
  runExperienceRuntimeJourneyScenario,
  runFakeExperienceLayerScenario,
} from '../experience-layer-e2e-scenario';

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

  it('runs the full fake-provider Experience runtime journey through shared truth', async () => {
    const result = await runExperienceRuntimeJourneyScenario();

    expect(result.providerCalls).toEqual({
      browser: 0,
      billing: 0,
      llm: 0,
      marketplace: 0,
      scheduler: 0,
      shortlink: 0,
      storage: 0,
    });
    expect(result.journeySteps).toEqual([
      'raw_prompt',
      'rewritten_prompt',
      'spec',
      'tdd_plan',
      'review_gate',
      'mission_draft',
      'mission_launch',
      'checkpoint_evidence',
      'vdi_update',
      'arena_branch',
      'trusted_agent_install',
      'team_package_fork',
      'final_verified_deliverable',
    ]);
    expect(result.finalState.missions).toContainEqual(
      expect.objectContaining({
        id: 'mission-run-e2e-deep-24h',
        status: 'completed',
      }),
    );
    expect(result.finalState.missions).toContainEqual(
      expect.objectContaining({
        id: 'mission-run-e2e-swarm-arena',
        mode: 'swarm_arena',
      }),
    );
    expect(result.finalState.checkpoints).toContainEqual(
      expect.objectContaining({
        id: 'checkpoint-e2e-6h',
        status: 'completed',
        artifactIds: ['artifact-e2e-checkpoint-1'],
      }),
    );
    expect(result.vdiBeforeEvidence).toBe(0);
    expect(result.finalMetric?.verifiedDeliverableIndex).toBeGreaterThan(result.vdiBeforeEvidence);
    expect(result.finalMetric?.evidenceRefs).toEqual(
      expect.arrayContaining(['artifact:artifact-e2e-final', 'gate:e2e-final-pass']),
    );
    expect(result.completedQuestIds).toEqual(
      expect.arrayContaining([
        'quest-frame-raw-prompt',
        'quest-rewrite-prompt',
        'quest-build-executable-spec',
        'quest-generate-tdd-plan',
        'quest-run-review-gate',
        'quest-launch-first-deep-mission',
        'quest-complete-checkpoint-with-evidence',
        'quest-final-verified-deliverable',
        'quest-launch-swarm-arena',
        'quest-install-trusted-agent-package',
        'quest-fork-package-team-registry',
      ]),
    );
    expect(result.finalState.installedAgentPackageIds).toContain('agent-package-trusted-reviewer');
    expect(result.swarmSignalIds).toEqual(['swarm-signal-architect']);
    expect(result.commandProjection).toEqual(result.gameProjection);
    expect(result.gameProjection).toEqual(result.arenaProjection);
    expect(result.replayedState).toEqual(result.finalState);
  });
});
