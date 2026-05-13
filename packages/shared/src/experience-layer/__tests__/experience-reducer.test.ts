/**
 * Tests for `experience-reducer` — M.9 T270.
 *
 * Drives the full (state x event) truth table: every legal pair produces the
 * expected next state, every illegal pair returns a typed `TransitionError`.
 * Also covers id-mismatch and mutation-id-mismatch guards.
 */
import { describe, it, expect } from 'bun:test';
import { unsafeExperienceId, type ExperienceId } from '../experience-id.ts';
import {
  fail as failEvt,
  load,
  loaded,
  mutate,
  mutationFailed,
  mutationSucceeded,
  reset,
  type ExperienceEvent,
} from '../experience-event.ts';
import {
  errored,
  idle,
  loading,
  mutating,
  ready,
  type ExperienceError,
  type ExperienceState,
} from '../experience-state.ts';
import { reducer } from '../experience-reducer.ts';

interface Snapshot {
  readonly title: string;
  readonly count: number;
}

const ID: ExperienceId = unsafeExperienceId('0190a4d2-1234-7abc-89de-0123456789ab');
const OTHER_ID: ExperienceId = unsafeExperienceId('0190a4d2-1234-7abc-89de-fedcba987654');

const SNAP_A: Snapshot = { title: 'hello', count: 1 };
const SNAP_B: Snapshot = { title: 'hello', count: 2 };

const ERR: ExperienceError = {
  kind: 'load-failed',
  message: 'network',
  at: 1_700_000_000_000,
};

function unwrap<T>(
  result: ReturnType<typeof reducer<T>>,
): ExperienceState<T> {
  if (!result.ok) {
    throw new Error(
      `expected ok=true, got error.kind=${result.error.kind}`,
    );
  }
  return result.value;
}

// ---------------------------------------------------------------------------
// Idle row
// ---------------------------------------------------------------------------

describe('reducer · idle', () => {
  const s = idle(ID);

  it('Load → Loading', () => {
    const next = unwrap(reducer<Snapshot>(s, load(ID, 100)));
    expect(next.kind).toBe('loading');
    if (next.kind === 'loading') expect(next.since).toBe(100);
  });

  it('Reset → Idle (noop legal)', () => {
    const next = unwrap(reducer<Snapshot>(s, reset(ID)));
    expect(next.kind).toBe('idle');
  });

  it('Fail → Error', () => {
    const next = unwrap(reducer<Snapshot>(s, failEvt(ID, ERR)));
    expect(next.kind).toBe('error');
  });

  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['Loaded', loaded(ID, SNAP_A)],
    ['Mutate', mutate(ID, 'm1', 1)],
    ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
    ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
  ])('%s → IllegalTransition', (_label, evt) => {
    const result = reducer<Snapshot>(s, evt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('IllegalTransition');
  });
});

// ---------------------------------------------------------------------------
// Loading row
// ---------------------------------------------------------------------------

describe('reducer · loading', () => {
  const s = loading(ID, 100);

  it('Load → Loading (restart with new `since`)', () => {
    const next = unwrap(reducer<Snapshot>(s, load(ID, 200)));
    expect(next.kind).toBe('loading');
    if (next.kind === 'loading') expect(next.since).toBe(200);
  });

  it('Loaded → Ready (version=1)', () => {
    const next = unwrap(reducer<Snapshot>(s, loaded(ID, SNAP_A)));
    expect(next.kind).toBe('ready');
    if (next.kind === 'ready') {
      expect(next.data).toBe(SNAP_A);
      expect(next.version).toBe(1);
    }
  });

  it('Fail → Error preserves error payload', () => {
    const next = unwrap(reducer<Snapshot>(s, failEvt(ID, ERR)));
    expect(next.kind).toBe('error');
    if (next.kind === 'error') expect(next.error).toBe(ERR);
  });

  it('Reset → Idle', () => {
    expect(unwrap(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle');
  });

  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['Mutate', mutate(ID, 'm1', 1)],
    ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
    ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
  ])('%s → IllegalTransition', (_label, evt) => {
    const result = reducer<Snapshot>(s, evt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('IllegalTransition');
  });
});

// ---------------------------------------------------------------------------
// Ready row
// ---------------------------------------------------------------------------

describe('reducer · ready', () => {
  const s = ready<Snapshot>(ID, SNAP_A, 3);

  it('Load → Loading (refetch)', () => {
    expect(unwrap(reducer<Snapshot>(s, load(ID, 100))).kind).toBe('loading');
  });

  it('Loaded → Ready bumps version', () => {
    const next = unwrap(reducer<Snapshot>(s, loaded(ID, SNAP_B)));
    if (next.kind === 'ready') {
      expect(next.version).toBe(4);
      expect(next.data).toBe(SNAP_B);
    } else {
      throw new Error('expected ready');
    }
  });

  it('Mutate → Mutating carries base snapshot + version', () => {
    const next = unwrap(reducer<Snapshot>(s, mutate(ID, 'm1', 100)));
    if (next.kind === 'mutating') {
      expect(next.data).toBe(SNAP_A);
      expect(next.baseVersion).toBe(3);
      expect(next.mutationId).toBe('m1');
      expect(next.since).toBe(100);
    } else {
      throw new Error('expected mutating');
    }
  });

  it('Fail → Error', () => {
    expect(unwrap(reducer<Snapshot>(s, failEvt(ID, ERR))).kind).toBe('error');
  });

  it('Reset → Idle drops the snapshot', () => {
    expect(unwrap(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle');
  });

  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
    ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
  ])('%s → IllegalTransition', (_label, evt) => {
    const result = reducer<Snapshot>(s, evt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('IllegalTransition');
  });
});

// ---------------------------------------------------------------------------
// Error row
// ---------------------------------------------------------------------------

describe('reducer · error', () => {
  const s = errored(ID, ERR);

  it('Load → Loading (retry)', () => {
    expect(unwrap(reducer<Snapshot>(s, load(ID, 100))).kind).toBe('loading');
  });

  it('Reset → Idle', () => {
    expect(unwrap(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle');
  });

  it('Fail → Error replaces the error payload', () => {
    const next = unwrap(reducer<Snapshot>(s, failEvt(ID, { ...ERR, message: 'replaced' })));
    if (next.kind === 'error') {
      expect(next.error.message).toBe('replaced');
    } else {
      throw new Error('expected error');
    }
  });

  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['Loaded', loaded(ID, SNAP_A)],
    ['Mutate', mutate(ID, 'm1', 1)],
    ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
    ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
  ])('%s → IllegalTransition', (_label, evt) => {
    const result = reducer<Snapshot>(s, evt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('IllegalTransition');
  });
});

// ---------------------------------------------------------------------------
// Mutating row
// ---------------------------------------------------------------------------

describe('reducer · mutating', () => {
  const s = mutating<Snapshot>(ID, SNAP_A, 3, 'm1', 100);

  it('MutationSucceeded (matching id) → Ready bumps from baseVersion', () => {
    const next = unwrap(reducer<Snapshot>(s, mutationSucceeded(ID, 'm1', SNAP_B)));
    if (next.kind === 'ready') {
      expect(next.data).toBe(SNAP_B);
      expect(next.version).toBe(4);
    } else {
      throw new Error('expected ready');
    }
  });

  it('MutationSucceeded with mismatched mutationId → MismatchedMutation', () => {
    const result = reducer<Snapshot>(s, mutationSucceeded(ID, 'mX', SNAP_B));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('MismatchedMutation');
  });

  it('MutationFailed recoverable=true → Ready restores baseVersion', () => {
    const next = unwrap(reducer<Snapshot>(s, mutationFailed(ID, 'm1', ERR, true)));
    if (next.kind === 'ready') {
      expect(next.data).toBe(SNAP_A);
      expect(next.version).toBe(3);
    } else {
      throw new Error('expected ready');
    }
  });

  it('MutationFailed recoverable=false → Error', () => {
    expect(unwrap(reducer<Snapshot>(s, mutationFailed(ID, 'm1', ERR, false))).kind).toBe(
      'error',
    );
  });

  it('MutationFailed mismatched mutationId → MismatchedMutation', () => {
    const result = reducer<Snapshot>(s, mutationFailed(ID, 'mX', ERR, true));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('MismatchedMutation');
  });

  it('Fail → Error (universal escape hatch even during mutation)', () => {
    expect(unwrap(reducer<Snapshot>(s, failEvt(ID, ERR))).kind).toBe('error');
  });

  it('Reset → Idle', () => {
    expect(unwrap(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle');
  });

  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['Load', load(ID, 200)],
    ['Loaded', loaded(ID, SNAP_A)],
    ['Mutate', mutate(ID, 'm2', 200)],
  ])('%s → IllegalTransition', (_label, evt) => {
    const result = reducer<Snapshot>(s, evt);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('IllegalTransition');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting guards
// ---------------------------------------------------------------------------

describe('reducer · id-mismatch guard', () => {
  it('returns MismatchedId when event.id != state.id', () => {
    const s = idle(ID);
    const result = reducer<Snapshot>(s, load(OTHER_ID, 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('MismatchedId');
      if (result.error.kind === 'MismatchedId') {
        expect(result.error.stateId).toBe(ID);
        expect(result.error.eventId).toBe(OTHER_ID);
      }
    }
  });

  it('mismatched id wins over otherwise-legal transition', () => {
    const s = ready<Snapshot>(ID, SNAP_A, 1);
    const result = reducer<Snapshot>(s, loaded(OTHER_ID, SNAP_B));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('MismatchedId');
  });
});

describe('reducer · TransitionError shape', () => {
  it('IllegalTransition carries both stateKind and eventKind', () => {
    const result = reducer<Snapshot>(idle(ID), loaded(ID, SNAP_A));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === 'IllegalTransition') {
      expect(result.error.stateKind).toBe('idle');
      expect(result.error.eventKind).toBe('loaded');
    }
  });

  it('reducer never throws — illegal pairs are values, not exceptions', () => {
    const s = idle(ID);
    expect(() => reducer<Snapshot>(s, mutate(ID, 'm', 1))).not.toThrow();
  });
});
