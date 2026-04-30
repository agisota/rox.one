import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { ArenaBuilderScreen } from '../ArenaBuilderScreen';
import {
  createArenaBuilderState,
  createArenaDraftRun,
  toggleArenaAgentSelection,
} from '../arena-builder-state';

describe('Arena Builder and Agent Collection', () => {
  test('renders agent roster, selected agents, swarm slots, and run estimate', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect', 'agent-skeptic'],
      entitlement: { maxSwarmSlots: 4 },
    });

    const markup = renderToStaticMarkup(<ArenaBuilderScreen initialState={state} />);

    expect(markup).toContain('Arena Builder');
    expect(markup).toContain('Agent Collection');
    expect(markup).toContain('Architect Prime');
    expect(markup).toContain('Skeptic Sentinel');
    expect(markup).toContain('Selected Agents');
    expect(markup).toContain('2 / 4 slots');
    expect(markup).toContain('Budget Estimate');
  });

  test('locked agents cannot be selected', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-locked-redteam'],
      entitlement: { maxSwarmSlots: 4 },
    });

    expect(state.selectedAgentPackageIds).not.toContain('agent-locked-redteam');
    expect(state.selectionWarnings).toContain('Red Team Oracle is locked and cannot be selected.');

    const next = toggleArenaAgentSelection(state, 'agent-locked-redteam');
    expect(next.selectedAgentPackageIds).not.toContain('agent-locked-redteam');
    expect(next.selectionWarnings).toContain('Red Team Oracle is locked and cannot be selected.');
  });

  test('swarm count respects entitlement capacity without changing validation truth', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect', 'agent-skeptic', 'agent-researcher', 'agent-qa'],
      entitlement: { maxSwarmSlots: 2 },
    });

    expect(state.selectedAgentPackageIds).toEqual(['agent-architect', 'agent-skeptic']);
    expect(state.selectionWarnings).toContain('Swarm selection is capped at 2 slots by current entitlement.');
    expect(state.runEstimate.swarmSlotsUsed).toBe(2);
    expect(state.runEstimate.swarmSlotLimit).toBe(2);
    expect(state.runEstimate.validationGateIds).toEqual(['schema', 'logic_check', 'fact_check', 'security_check']);
  });

  test('budget estimate updates from selected agents', () => {
    const base = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect'],
      entitlement: { maxSwarmSlots: 4 },
    });
    const expanded = toggleArenaAgentSelection(base, 'agent-researcher');

    expect(base.runEstimate.budgetEstimateCredits).toBe(24);
    expect(expanded.runEstimate.budgetEstimateCredits).toBe(52);
    expect(expanded.runEstimate.estimatedContributionCount).toBe(26);
  });

  test('selected agents persist into draft run payload', () => {
    const state = createArenaBuilderState({
      selectedAgentPackageIds: ['agent-architect', 'agent-qa'],
      entitlement: { maxSwarmSlots: 4 },
    });

    const draftRun = createArenaDraftRun(state);

    expect(draftRun.mode).toBe('swarm_arena');
    expect(draftRun.experienceLayer).toBe('arena');
    expect(draftRun.selectedAgentPackageIds).toEqual(['agent-architect', 'agent-qa']);
    expect(draftRun.budgetEstimateCredits).toBe(42);
    expect(draftRun.requiredGateIds).toEqual(['schema', 'logic_check', 'fact_check', 'security_check']);
  });
});
