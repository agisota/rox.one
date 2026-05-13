import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  createInitialExperienceRuntimeState,
  replayExperienceEvents,
  type ExperienceEvent,
} from '@rox-one/shared/workbench';

import {
  ExperienceGlobalHud,
  createExperienceGlobalHudState,
} from '../ExperienceGlobalHud';

const NOW = '2026-05-06T00:00:00.000Z';

const runtimeEvents: ExperienceEvent[] = [
  {
    id: 'evt-prompt-submitted',
    type: 'prompt.submitted',
    createdAt: NOW,
    payload: {
      artifactId: 'brief',
      rawPrompt: 'Build a verified release candidate',
    },
  },
  {
    id: 'evt-prompt-rewritten',
    type: 'prompt.rewritten',
    createdAt: NOW,
    payload: {
      artifactId: 'rewrite',
      sourceArtifactId: 'brief',
      rewrittenPrompt: 'Build a verified release candidate with tests and evidence',
    },
  },
  {
    id: 'evt-spec-compiled',
    type: 'spec.compiled',
    createdAt: NOW,
    payload: {
      artifactId: 'spec',
      sourceArtifactId: 'rewrite',
      title: 'Release candidate spec',
    },
  },
  {
    id: 'evt-mission-launched',
    type: 'mission.launched',
    createdAt: NOW,
    payload: {
      mission: {
        id: 'mission-rc',
        ownerUserId: 'user-one',
        teamId: 'team-alpha',
        workspaceId: 'workspace-main',
        sourceArtifactId: 'artifact:spec',
        mode: 'deep_run',
        experienceLayer: 'command',
        title: 'RC evidence mission',
        objective: 'Produce a verified release candidate evidence pack.',
        durationHours: 24,
        checkpointCadenceHours: 6,
        status: 'running',
        vdiTarget: 90,
        budgetCapCredits: 500,
        tokenCap: 1_000_000,
        storageCapBytes: 1_073_741_824,
        selectedAgentPackageIds: [],
        requiredGateIds: ['schema', 'fact_check', 'security_check'],
        createdAt: NOW,
        startedAt: NOW,
      },
      checkpoints: [],
    },
  },
  {
    id: 'evt-gate-failed',
    type: 'gate.failed',
    createdAt: NOW,
    payload: {
      missionRunId: 'mission-rc',
      gateId: 'security_check',
      evidenceRef: 'gate:security:failed',
      blocking: true,
    },
  },
  {
    id: 'evt-xp',
    type: 'ledger.entry.recorded',
    createdAt: NOW,
    payload: {
      entry: {
        id: 'ledger-xp',
        userId: 'user-one',
        teamId: 'team-alpha',
        eventType: 'xp',
        amount: 120,
        currency: 'xp',
        reason: 'Accepted verified mission artifact',
        sourceArtifactId: 'artifact:spec',
        createdAt: NOW,
      },
    },
  },
];

describe('ExperienceGlobalHud', () => {
  test('renders compact runtime truth from Experience events', () => {
    const runtimeState = replayExperienceEvents(runtimeEvents, createInitialExperienceRuntimeState());
    const hudState = createExperienceGlobalHudState(runtimeState, 'command');
    const markup = renderToStaticMarkup(<ExperienceGlobalHud runtimeState={runtimeState} layer="command" />);

    expect(hudState.activeMissionTitle).toBe('RC evidence mission');
    expect(hudState.blockers).toContain('security_check');
    expect(hudState.xp).toBe(120);
    expect(markup).toContain('ROX Experience');
    expect(markup).toContain('VDI');
    expect(markup).toContain('Готовность');
    expect(markup).toContain('RC evidence mission');
    expect(markup).toContain('security_check');
    expect(markup).toContain('120 XP');
    expect(markup).toContain('Gate security_check fail');
  });

  test('keeps Command, Game, and Arena modes on the same truth values', () => {
    const runtimeState = replayExperienceEvents(runtimeEvents);
    const command = createExperienceGlobalHudState(runtimeState, 'command');
    const game = createExperienceGlobalHudState(runtimeState, 'game');
    const arena = createExperienceGlobalHudState(runtimeState, 'arena');

    expect(game.verifiedDeliverableIndex).toBe(command.verifiedDeliverableIndex);
    expect(arena.executionReadiness).toBe(command.executionReadiness);
    expect(game.activeMissionTitle).toBe(command.activeMissionTitle);
    expect(arena.blockers).toEqual(command.blockers);
  });

  test('uses wrapping and min-width safe classes for compact widths', () => {
    const runtimeState = replayExperienceEvents(runtimeEvents);
    const markup = renderToStaticMarkup(<ExperienceGlobalHud runtimeState={runtimeState} layer="game" />);

    expect(markup).toContain('max-w-full');
    expect(markup).toContain('min-w-0');
    expect(markup).toContain('flex-wrap');
  });

  test('does not invent an Artifact accepted chip when no artifact exists', () => {
    const runtimeState = createInitialExperienceRuntimeState();
    const markup = renderToStaticMarkup(<ExperienceGlobalHud runtimeState={runtimeState} layer="command" />);

    expect(markup).toContain('Нет новых событий');
    expect(markup).not.toContain('Artifact accepted');
    expect(markup).not.toContain('data-feedback-kind="artifact_accepted"');
  });
});
