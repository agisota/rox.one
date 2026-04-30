import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MissionControlRunDetail } from '../MissionControlRunDetail';
import {
  approveMissionBranch,
  createMissionControlState,
  transitionMissionCheckpoint,
} from '../mission-control-state';

describe('Mission Control run detail', () => {
  test('renders active run timeline, feed, gates, approvals, artifacts, audit, and billing trace', () => {
    const state = createMissionControlState();
    const markup = renderToStaticMarkup(<MissionControlRunDetail initialState={state} />);

    expect(markup).toContain('Mission Control');
    expect(markup).toContain('Checkpoint 6h');
    expect(markup).toContain('Swarm Feed');
    expect(markup).toContain('Validation Gates');
    expect(markup).toContain('Human Approvals');
    expect(markup).toContain('Interim Artifacts');
    expect(markup).toContain('Audit and Billing Trace');
  });

  test('checkpoint state transitions are deterministic', () => {
    const state = createMissionControlState();
    const running = transitionMissionCheckpoint(state, 'cp-6h', 'running');
    const completed = transitionMissionCheckpoint(running, 'cp-6h', 'completed');

    expect(running.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('running');
    expect(completed.checkpoints.find((checkpoint) => checkpoint.id === 'cp-6h')?.status).toBe('completed');
    expect(completed.auditEvents.at(-1)?.summary).toBe('Checkpoint Checkpoint 6h moved to completed.');
  });

  test('pending approval blocks expensive branch until approved', () => {
    const state = createMissionControlState();

    expect(state.canRunExpensiveBranch).toBe(false);
    expect(state.blockingReasons).toContain('Approval required for expensive branch: 100-agent swarm expansion.');

    const approved = approveMissionBranch(state, 'approval-expensive-branch');
    expect(approved.canRunExpensiveBranch).toBe(true);
    expect(approved.blockingReasons).not.toContain('Approval required for expensive branch: 100-agent swarm expansion.');
  });

  test('critical gate failure blocks final pass even after approval', () => {
    const approved = approveMissionBranch(createMissionControlState(), 'approval-expensive-branch');

    expect(approved.canFinalize).toBe(false);
    expect(approved.blockingReasons).toContain('Critical validation gate failed: security_check.');
  });

  test('interim artifacts render by checkpoint', () => {
    const state = createMissionControlState();
    const markup = renderToStaticMarkup(<MissionControlRunDetail initialState={state} />);

    expect(markup).toContain('6h contradiction map');
    expect(markup).toContain('cp-6h');
    expect(markup).toContain('12h evidence memo');
    expect(markup).toContain('cp-12h');
  });
});
