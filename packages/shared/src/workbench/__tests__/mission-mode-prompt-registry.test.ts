import { describe, expect, it } from 'bun:test';

import {
  compileMissionModePrompt,
  getMissionModePromptContract,
  getMissionModePromptRegistry,
} from '../mission-mode-prompt-registry';
import type { MissionMode } from '../experience-layer';

const REQUIRED_MODES: MissionMode[] = [
  'deep_run',
  'deep_reasoning_lab',
  'agenda_carnage',
  'swarm_arena',
  'round_table',
  'autoresearch_loop',
  'proactive_watchtower',
];

describe('MissionModePromptRegistry', () => {
  it('defines a complete prompt/runtime contract for every mission mode', () => {
    const registry = getMissionModePromptRegistry();

    expect(registry.map((contract) => contract.mode)).toEqual(REQUIRED_MODES);

    for (const contract of registry) {
      expect(contract.role).toBeTruthy();
      expect(contract.objective).toBeTruthy();
      expect(contract.inputContract.requiredFields).toContain('objective');
      expect(contract.outputContract.requiredFields).toContain('summary');
      expect(contract.requiredArtifacts.length).toBeGreaterThan(0);
      expect(contract.validationGates).toContain('schema');
      expect(contract.checkpointBehavior.requiresEvidence).toBe(true);
      expect(contract.providerCapabilities.length).toBeGreaterThan(0);
      expect(contract.failureModes.length).toBeGreaterThan(0);
    }
  });

  it('compiles a deterministic prompt with mission input and validation contract', () => {
    const prompt = compileMissionModePrompt(getMissionModePromptContract('deep_run'), {
      missionRunId: 'mission-rc',
      title: 'Release candidate',
      objective: 'Produce verified RC evidence.',
      rawInput: 'User supplied release scope.',
      checkpointOrdinal: 1,
    });

    expect(prompt).toContain('Role: Long-running mission operator');
    expect(prompt).toContain('Objective: Produce verified RC evidence.');
    expect(prompt).toContain('Required artifacts: report, review');
    expect(prompt).toContain('Validation gates: schema, logic_check, fact_check, security_check');
    expect(prompt).toContain('Checkpoint 1');
    expect(prompt).not.toContain('undefined');
  });
});
