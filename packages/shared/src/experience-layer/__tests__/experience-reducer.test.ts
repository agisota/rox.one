/** Tests for `experience-reducer` — M.9 T270. Drives the full truth table. */
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

interface Snapshot { readonly title: string; readonly count: number }

const ID: ExperienceId = unsafeExperienceId('0190a4d2-1234-7abc-89de-0123456789ab');
const OTHER_ID: ExperienceId = unsafeExperienceId('0190a4d2-1234-7abc-89de-fedcba987654');
const SNAP_A: Snapshot = { title: 'hello', count: 1 };
const SNAP_B: Snapshot = { title: 'hello', count: 2 };
const ERR: ExperienceError = { kind: 'load-failed', message: 'network', at: 1_700_000_000_000 };

function ok<T>(r: ReturnType<typeof reducer<T>>): ExperienceState<T> {
  if (!r.ok) throw new Error(`expected ok=true, got error.kind=${r.error.kind}`);
  return r.value;
}

function expectIllegal<T>(r: ReturnType<typeof reducer<T>>): void {
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.kind).toBe('IllegalTransition');
}

const ILLEGAL_FROM_IDLE_OR_ERROR: Array<[string, ExperienceEvent<Snapshot>]> = [
  ['Loaded', loaded(ID, SNAP_A)],
  ['Mutate', mutate(ID, 'm1', 1)],
  ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
  ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
];

describe('reducer · idle', () => {
  const s = idle(ID);
  it('Load → Loading', () => {
    const n = ok(reducer<Snapshot>(s, load(ID, 100)));
    if (n.kind !== 'loading') throw new Error('expected loading');
    expect(n.since).toBe(100);
  });
  it('Reset → Idle (legal noop)', () => expect(ok(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle'));
  it('Fail → Error', () => expect(ok(reducer<Snapshot>(s, failEvt(ID, ERR))).kind).toBe('error'));
  it.each(ILLEGAL_FROM_IDLE_OR_ERROR)('%s → IllegalTransition', (_l, evt) =>
    expectIllegal(reducer<Snapshot>(s, evt)),
  );
});

describe('reducer · loading', () => {
  const s = loading(ID, 100);
  it('Load → Loading (restart with new since)', () => {
    const n = ok(reducer<Snapshot>(s, load(ID, 200)));
    if (n.kind !== 'loading') throw new Error('expected loading');
    expect(n.since).toBe(200);
  });
  it('Loaded → Ready (version=1)', () => {
    const n = ok(reducer<Snapshot>(s, loaded(ID, SNAP_A)));
    if (n.kind !== 'ready') throw new Error('expected ready');
    expect(n.data).toBe(SNAP_A);
    expect(n.version).toBe(1);
  });
  it('Fail → Error preserves payload', () => {
    const n = ok(reducer<Snapshot>(s, failEvt(ID, ERR)));
    if (n.kind !== 'error') throw new Error('expected error');
    expect(n.error).toBe(ERR);
  });
  it('Reset → Idle', () => expect(ok(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle'));
  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['Mutate', mutate(ID, 'm1', 1)],
    ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
    ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
  ])('%s → IllegalTransition', (_l, evt) => expectIllegal(reducer<Snapshot>(s, evt)));
});

describe('reducer · ready', () => {
  const s = ready<Snapshot>(ID, SNAP_A, 3);
  it('Load → Loading (refetch)', () =>
    expect(ok(reducer<Snapshot>(s, load(ID, 100))).kind).toBe('loading'));
  it('Loaded → Ready bumps version', () => {
    const n = ok(reducer<Snapshot>(s, loaded(ID, SNAP_B)));
    if (n.kind !== 'ready') throw new Error('expected ready');
    expect(n.version).toBe(4);
    expect(n.data).toBe(SNAP_B);
  });
  it('Mutate → Mutating carries base snapshot + version', () => {
    const n = ok(reducer<Snapshot>(s, mutate(ID, 'm1', 100)));
    if (n.kind !== 'mutating') throw new Error('expected mutating');
    expect(n.data).toBe(SNAP_A);
    expect(n.baseVersion).toBe(3);
    expect(n.mutationId).toBe('m1');
    expect(n.since).toBe(100);
  });
  it('Fail → Error', () => expect(ok(reducer<Snapshot>(s, failEvt(ID, ERR))).kind).toBe('error'));
  it('Reset → Idle drops the snapshot', () =>
    expect(ok(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle'));
  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['MutationSucceeded', mutationSucceeded(ID, 'm1', SNAP_A)],
    ['MutationFailed', mutationFailed(ID, 'm1', ERR, true)],
  ])('%s → IllegalTransition', (_l, evt) => expectIllegal(reducer<Snapshot>(s, evt)));
});

describe('reducer · error', () => {
  const s = errored(ID, ERR);
  it('Load → Loading (retry)', () =>
    expect(ok(reducer<Snapshot>(s, load(ID, 100))).kind).toBe('loading'));
  it('Reset → Idle', () => expect(ok(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle'));
  it('Fail → Error replaces the error payload', () => {
    const n = ok(reducer<Snapshot>(s, failEvt(ID, { ...ERR, message: 'replaced' })));
    if (n.kind !== 'error') throw new Error('expected error');
    expect(n.error.message).toBe('replaced');
  });
  it.each(ILLEGAL_FROM_IDLE_OR_ERROR)('%s → IllegalTransition', (_l, evt) =>
    expectIllegal(reducer<Snapshot>(s, evt)),
  );
});

describe('reducer · mutating', () => {
  const s = mutating<Snapshot>(ID, SNAP_A, 3, 'm1', 100);
  it('MutationSucceeded (matching id) → Ready bumps from baseVersion', () => {
    const n = ok(reducer<Snapshot>(s, mutationSucceeded(ID, 'm1', SNAP_B)));
    if (n.kind !== 'ready') throw new Error('expected ready');
    expect(n.data).toBe(SNAP_B);
    expect(n.version).toBe(4);
  });
  it('MutationSucceeded mismatched id → MismatchedMutation', () => {
    const r = reducer<Snapshot>(s, mutationSucceeded(ID, 'mX', SNAP_B));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('MismatchedMutation');
  });
  it('MutationFailed recoverable=true → Ready restores baseVersion', () => {
    const n = ok(reducer<Snapshot>(s, mutationFailed(ID, 'm1', ERR, true)));
    if (n.kind !== 'ready') throw new Error('expected ready');
    expect(n.data).toBe(SNAP_A);
    expect(n.version).toBe(3);
  });
  it('MutationFailed recoverable=false → Error', () =>
    expect(ok(reducer<Snapshot>(s, mutationFailed(ID, 'm1', ERR, false))).kind).toBe('error'));
  it('MutationFailed mismatched id → MismatchedMutation', () => {
    const r = reducer<Snapshot>(s, mutationFailed(ID, 'mX', ERR, true));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('MismatchedMutation');
  });
  it('Fail → Error (universal even during mutation)', () =>
    expect(ok(reducer<Snapshot>(s, failEvt(ID, ERR))).kind).toBe('error'));
  it('Reset → Idle', () => expect(ok(reducer<Snapshot>(s, reset(ID))).kind).toBe('idle'));
  it.each<[string, ExperienceEvent<Snapshot>]>([
    ['Load', load(ID, 200)],
    ['Loaded', loaded(ID, SNAP_A)],
    ['Mutate', mutate(ID, 'm2', 200)],
  ])('%s → IllegalTransition', (_l, evt) => expectIllegal(reducer<Snapshot>(s, evt)));
});

describe('reducer · id-mismatch + transition-error shape', () => {
  it('returns MismatchedId when event.id != state.id', () => {
    const r = reducer<Snapshot>(idle(ID), load(OTHER_ID, 1));
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === 'MismatchedId') {
      expect(r.error.stateId).toBe(ID);
      expect(r.error.eventId).toBe(OTHER_ID);
    } else throw new Error('expected MismatchedId');
  });
  it('mismatched id wins over otherwise-legal transition', () => {
    const r = reducer<Snapshot>(ready<Snapshot>(ID, SNAP_A, 1), loaded(OTHER_ID, SNAP_B));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('MismatchedId');
  });
  it('IllegalTransition carries both stateKind and eventKind', () => {
    const r = reducer<Snapshot>(idle(ID), loaded(ID, SNAP_A));
    if (!r.ok && r.error.kind === 'IllegalTransition') {
      expect(r.error.stateKind).toBe('idle');
      expect(r.error.eventKind).toBe('loaded');
    } else throw new Error('expected IllegalTransition');
  });
  it('reducer never throws — illegal pairs are values', () =>
    expect(() => reducer<Snapshot>(idle(ID), mutate(ID, 'm', 1))).not.toThrow());
});
