import { describe, expect, it } from 'bun:test';

import { MissionRunSchema } from '../experience-layer';
import {
  ExperienceLayerPolicySchema,
  ExperienceLayerRegistryEntrySchema,
  getAvailableExperienceLayers,
  getExperienceLayerRegistry,
  projectExperienceLayerSwitch,
  resolveExperienceLayerPolicy,
} from '../experience-layer-registry';

const createdAt = '2026-04-30T12:00:00.000Z';

function createMission() {
  return MissionRunSchema.parse({
    id: 'mission-registry-001',
    ownerUserId: 'user-001',
    teamId: 'team-001',
    workspaceId: 'workspace-001',
    sourceArtifactId: 'artifact-source-001',
    mode: 'deep_run',
    experienceLayer: 'command',
    title: 'Registry truth switch',
    objective: 'Switch layers without changing operational truth.',
    durationHours: 24,
    checkpointCadenceHours: 6,
    status: 'running',
    vdiTarget: 80,
    budgetCapCredits: 200,
    tokenCap: 1_000_000,
    storageCapBytes: 1_073_741_824,
    selectedAgentPackageIds: ['agent-package-001'],
    requiredGateIds: ['schema', 'logic_check', 'fact_check'],
    createdAt,
  });
}

describe('Experience Layer registry', () => {
  it('defines every presentation layer with stable labels and feature flags', () => {
    const registry = getExperienceLayerRegistry();

    expect(registry.map((entry) => entry.layer)).toEqual(['command', 'game', 'arena']);

    for (const entry of registry) {
      const parsed = ExperienceLayerRegistryEntrySchema.parse(entry);
      expect(parsed.labelKey).toBe(`experience.layers.${entry.layer}.label`);
      expect(parsed.descriptionKey).toBe(`experience.layers.${entry.layer}.description`);
      expect(parsed.featureFlags.length).toBeGreaterThan(0);
      expect(parsed.defaultEnabled).toBe(entry.layer === 'command');
    }
  });

  it('keeps Command available even when Game and Arena are disabled by enterprise policy', () => {
    const policy = resolveExperienceLayerPolicy({
      allowGameLayer: false,
      allowArenaLayer: false,
      disabledReason: 'enterprise_policy',
    });

    expect(ExperienceLayerPolicySchema.parse(policy).availableLayers).toEqual(['command']);
    expect(policy.disabledLayers).toEqual(['game', 'arena']);
    expect(policy.disabledReasons).toEqual({
      game: 'enterprise_policy',
      arena: 'enterprise_policy',
    });

    expect(getAvailableExperienceLayers(policy).map((entry) => entry.layer)).toEqual(['command']);
  });

  it('allows Command, Game, and Arena when policy enables the full experience', () => {
    const policy = resolveExperienceLayerPolicy({
      allowGameLayer: true,
      allowArenaLayer: true,
    });

    expect(policy.availableLayers).toEqual(['command', 'game', 'arena']);
    expect(getAvailableExperienceLayers(policy).map((entry) => entry.layer)).toEqual(['command', 'game', 'arena']);
  });

  it('projects layer switches without mutating mission, artifact, gate, or ledger truth', () => {
    const mission = createMission();
    const ledgerRowIds = ['ledger-xp-001', 'ledger-unlock-001'];

    const switchToGame = projectExperienceLayerSwitch({
      missionRun: mission,
      fromLayer: 'command',
      toLayer: 'game',
      ledgerRowIds,
    });

    expect(switchToGame.fromLayer).toBe('command');
    expect(switchToGame.toLayer).toBe('game');
    expect(switchToGame.allowed).toBe(true);
    expect(switchToGame.truthBefore).toEqual(switchToGame.truthAfter);
    expect(switchToGame.truthAfter).toEqual({
      missionId: mission.id,
      artifactIds: ['artifact-source-001'],
      requiredGateIds: mission.requiredGateIds,
      ledgerRowIds,
      validationSemanticsMutable: false,
      ledgerSemanticsMutable: false,
    });
  });

  it('blocks unavailable layers without changing the target mission truth', () => {
    const mission = createMission();
    const policy = resolveExperienceLayerPolicy({
      allowGameLayer: true,
      allowArenaLayer: false,
      disabledReason: 'enterprise_policy',
    });

    const switchToArena = projectExperienceLayerSwitch({
      missionRun: mission,
      fromLayer: 'command',
      toLayer: 'arena',
      policy,
      ledgerRowIds: ['ledger-001'],
    });

    expect(switchToArena.allowed).toBe(false);
    expect(switchToArena.blockedReason).toBe('enterprise_policy');
    expect(switchToArena.truthBefore).toEqual(switchToArena.truthAfter);
  });
});
