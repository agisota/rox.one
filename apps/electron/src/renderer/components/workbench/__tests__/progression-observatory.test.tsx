import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { ProgressionObservatory } from '../ProgressionObservatory';
import {
  appendProgressLedgerEvent,
  createProgressionState,
  projectLeaderboardRows,
} from '../progression-observatory-state';

describe('Progression Observatory', () => {
  test('renders VDI and submetrics from metric snapshots', () => {
    const state = createProgressionState();
    const markup = renderToStaticMarkup(<ProgressionObservatory initialState={state} />);

    expect(markup).toContain('Progression Observatory');
    expect(markup).toContain('Verified Deliverable Index');
    expect(markup).toContain('86');
    expect(markup).toContain('Quality Score');
    expect(markup).toContain('Execution Readiness');
    expect(markup).toContain('Cost Efficiency');
  });

  test('XP ledger events require artifact or validation gate evidence', () => {
    expect(() =>
      appendProgressLedgerEvent(createProgressionState(), {
        id: 'ledger-bad-xp',
        userId: 'user-one',
        eventType: 'xp',
        amount: 20,
        currency: 'xp',
        reason: 'Unsupported XP claim',
        createdAt: '2026-04-30T00:00:00.000Z',
      }),
    ).toThrow('XP and unlock ledger events require artifact or validation gate evidence');
  });

  test('leaderboard privacy policy is enforced', () => {
    const privateState = createProgressionState({
      leaderboardPolicy: { showLeaderboards: false, viewerTeamId: 'team-alpha' },
    });
    const visibleState = createProgressionState({
      leaderboardPolicy: { showLeaderboards: true, viewerTeamId: 'team-alpha' },
    });

    expect(projectLeaderboardRows(privateState)).toEqual([]);
    expect(projectLeaderboardRows(visibleState).map((row) => row.displayName)).toEqual(['ROX Core', 'Alpha Team']);
  });

  test('paid capacity does not change quality score or VDI', () => {
    const base = createProgressionState({
      entitlement: { swarmSlots: 4, maxMissionHours: 24 },
    });
    const paid = createProgressionState({
      entitlement: { swarmSlots: 100, maxMissionHours: 72 },
    });

    expect(base.latestSnapshot.qualityScore).toBe(paid.latestSnapshot.qualityScore);
    expect(base.latestSnapshot.verifiedDeliverableIndex).toBe(paid.latestSnapshot.verifiedDeliverableIndex);
    expect(paid.capacity.swarmSlots).toBe(100);
    expect(paid.capacity.maxMissionHours).toBe(72);
  });
});
