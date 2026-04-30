import { describe, expect, it } from 'bun:test';

import {
  createFakeMissionSchedulerState,
  executeDueMissionCheckpoints,
} from '../mission-scheduler-adapter';

describe('mission scheduler adapter', () => {
  it('creates a run event when a checkpoint is due', () => {
    const state = createFakeMissionSchedulerState();
    const next = executeDueMissionCheckpoints(state, { now: '2026-04-30T06:00:00.000Z' });

    expect(next.events).toContainEqual(
      expect.objectContaining({
        id: 'event-mission-run-1-cp-6h-executed',
        missionRunId: 'mission-run-1',
        checkpointId: 'cp-6h',
        type: 'checkpoint_executed',
      }),
    );
    expect(next.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('completed');
  });

  it('executes checkpoints idempotently', () => {
    const state = createFakeMissionSchedulerState();
    const once = executeDueMissionCheckpoints(state, { now: '2026-04-30T06:00:00.000Z' });
    const twice = executeDueMissionCheckpoints(once, { now: '2026-04-30T06:00:00.000Z' });

    expect(twice.events.filter((event) => event.checkpointId === 'cp-6h' && event.type === 'checkpoint_executed')).toHaveLength(1);
    expect(twice.executedIdempotencyKeys).toEqual(['mission-run-1:cp-6h']);
  });

  it('pauses mission when budget is exhausted', () => {
    const state = createFakeMissionSchedulerState({
      budgetRemainingCreditsByMissionId: { 'mission-run-1': 5 },
    });
    const next = executeDueMissionCheckpoints(state, { now: '2026-04-30T06:00:00.000Z' });

    expect(next.missions.find((mission) => mission.id === 'mission-run-1')?.status).toBe('paused');
    expect(next.events).toContainEqual(
      expect.objectContaining({
        type: 'budget_exhausted',
        checkpointId: 'cp-6h',
      }),
    );
    expect(next.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('blocked');
  });

  it('does not execute future checkpoints for cancelled missions', () => {
    const state = createFakeMissionSchedulerState({
      missionStatus: 'cancelled',
    });
    const next = executeDueMissionCheckpoints(state, { now: '2026-04-30T24:00:00.000Z' });

    expect(next.events).toHaveLength(0);
    expect(next.checkpoints.every((checkpoint) => checkpoint.status === 'queued')).toBe(true);
  });
});
