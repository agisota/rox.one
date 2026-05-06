import { describe, expect, it } from 'bun:test';

import type { MissionGateResult, MissionRun } from '../experience-layer';
import {
  assertMissionRunTransition,
  canFinalizeMissionRun,
  isExecutableMissionRunStatus,
  normalizeMissionRunForLaunch,
  projectMissionRunStatusFromSchedulerEvents,
} from '../mission-lifecycle';

const NOW = '2026-05-06T00:00:00.000Z';

describe('MissionRun lifecycle contract', () => {
  it('normalizes launch into queued status before the first scheduler tick', () => {
    const runningPayload = createMission({ status: 'running', startedAt: NOW });

    expect(normalizeMissionRunForLaunch(runningPayload, NOW)).toMatchObject({
      id: runningPayload.id,
      status: 'queued',
      startedAt: NOW,
    });
  });

  it('allows only canonical MissionRun transitions', () => {
    expect(assertMissionRunTransition('draft', 'queued')).toBe('queued');
    expect(assertMissionRunTransition('queued', 'running')).toBe('running');
    expect(assertMissionRunTransition('running', 'paused')).toBe('paused');
    expect(assertMissionRunTransition('paused', 'running')).toBe('running');
    expect(assertMissionRunTransition('running', 'waiting_for_approval')).toBe('waiting_for_approval');
    expect(assertMissionRunTransition('waiting_for_approval', 'running')).toBe('running');
    expect(assertMissionRunTransition('running', 'completed')).toBe('completed');

    expect(() => assertMissionRunTransition('draft', 'completed')).toThrow('Invalid MissionRun status transition: draft -> completed');
    expect(() => assertMissionRunTransition('completed', 'running')).toThrow('Invalid MissionRun status transition: completed -> running');
  });

  it('keeps executable statuses limited to queued and running', () => {
    expect(isExecutableMissionRunStatus('queued')).toBe(true);
    expect(isExecutableMissionRunStatus('running')).toBe(true);
    expect(isExecutableMissionRunStatus('paused')).toBe(false);
    expect(isExecutableMissionRunStatus('waiting_for_approval')).toBe(false);
    expect(isExecutableMissionRunStatus('completed')).toBe(false);
  });

  it('requires stored final artifact and passing gate evidence for finalization', () => {
    const mission = createMission({ status: 'running' });
    const passingGate: MissionGateResult & { missionRunId: string } = {
      missionRunId: mission.id,
      gateId: 'schema',
      status: 'pass',
      evidenceRef: 'gate:schema:passed',
    };

    expect(canFinalizeMissionRun({
      mission,
      finalArtifactId: 'artifact:final',
      gateEvidenceRefs: ['gate:schema:passed'],
      artifacts: [{ id: 'artifact:final', missionRunId: mission.id }],
      gateResults: [passingGate],
    })).toEqual({ allowed: true, reasons: [] });

    expect(canFinalizeMissionRun({
      mission,
      finalArtifactId: 'artifact:missing',
      gateEvidenceRefs: ['gate:schema:passed'],
      artifacts: [],
      gateResults: [passingGate],
    }).reasons).toContain('missing_stored_final_artifact');

    expect(canFinalizeMissionRun({
      mission,
      finalArtifactId: 'artifact:final',
      gateEvidenceRefs: ['gate:schema:passed'],
      artifacts: [{ id: 'artifact:final', missionRunId: mission.id }],
      gateResults: [{ ...passingGate, status: 'fail', blocking: true }],
    }).reasons).toContain('blocking_gate_failed');
  });

  it('projects scheduler lifecycle events into canonical MissionRun status', () => {
    const mission = createMission({ status: 'draft' });

    expect(projectMissionRunStatusFromSchedulerEvents(mission, [
      schedulerEvent('mission_queued'),
    ])).toBe('queued');

    expect(projectMissionRunStatusFromSchedulerEvents(mission, [
      schedulerEvent('mission_queued'),
      schedulerEvent('checkpoint_completed'),
    ])).toBe('running');

    expect(projectMissionRunStatusFromSchedulerEvents(mission, [
      schedulerEvent('mission_queued'),
      schedulerEvent('checkpoint_budget_blocked'),
    ])).toBe('paused');

    expect(projectMissionRunStatusFromSchedulerEvents(mission, [
      schedulerEvent('mission_queued'),
      schedulerEvent('branch_expansion_waiting_for_approval'),
      schedulerEvent('branch_expansion_approved'),
    ])).toBe('running');

    expect(projectMissionRunStatusFromSchedulerEvents(mission, [
      schedulerEvent('mission_queued'),
      schedulerEvent('checkpoint_completed'),
      schedulerEvent('mission_completed'),
      schedulerEvent('checkpoint_budget_blocked'),
    ])).toBe('completed');
  });
});

function createMission(input: Partial<MissionRun> = {}): MissionRun {
  return {
    id: input.id ?? 'mission-lifecycle',
    ownerUserId: input.ownerUserId ?? 'user-one',
    workspaceId: input.workspaceId ?? 'workspace-main',
    mode: input.mode ?? 'deep_run',
    experienceLayer: input.experienceLayer ?? 'command',
    title: input.title ?? 'Lifecycle mission',
    objective: input.objective ?? 'Prove lifecycle semantics.',
    durationHours: input.durationHours ?? 24,
    checkpointCadenceHours: input.checkpointCadenceHours ?? 6,
    status: input.status ?? 'draft',
    vdiTarget: input.vdiTarget ?? 80,
    budgetCapCredits: input.budgetCapCredits ?? 120,
    tokenCap: input.tokenCap ?? 500_000,
    storageCapBytes: input.storageCapBytes ?? 536_870_912,
    selectedAgentPackageIds: input.selectedAgentPackageIds ?? ['agent-1'],
    requiredGateIds: input.requiredGateIds ?? ['schema', 'logic_check'],
    createdAt: input.createdAt ?? NOW,
    ...(input.startedAt ? { startedAt: input.startedAt } : {}),
  };
}

function schedulerEvent(type: string) {
  return {
    id: `event-${type}`,
    missionRunId: 'mission-lifecycle',
    type,
    createdAt: NOW,
    payload: {},
  };
}
