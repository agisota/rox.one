/**
 * Tests for `experience-bind` — M.9 T270.
 *
 * Exercises the adapter end-to-end:
 *   - subscribe → start → source emits → state becomes Ready
 *   - mutation lifecycle (success and failure)
 *   - source error → Error state
 *   - listeners + dispose semantics
 *   - illegal transitions surface through `onTransitionError` without
 *     mutating state.
 */
import { describe, it, expect } from 'bun:test';
import {
  bindExperience,
  createSubject,
  type Observable,
  type Observer,
  type Unsubscribe,
} from '../experience-bind.ts';
import { idle } from '../experience-state.ts';
import { unsafeExperienceId } from '../experience-id.ts';
import type { TransitionError } from '../experience-reducer.ts';

interface Snapshot {
  readonly count: number;
}

const ID = unsafeExperienceId('0190a4d2-1234-7abc-89de-0123456789ab');

function makeClock(start = 1_000): { now: () => number; advance: (n: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance(n) {
      t += n;
    },
  };
}

function makeMutationIds(): { next: () => string; count: number } {
  let i = 0;
  const counter = {
    get count() {
      return i;
    },
    next() {
      i += 1;
      return `m-${i}`;
    },
  };
  return counter as unknown as { next: () => string; count: number };
}

describe('bindExperience · subscribe + start', () => {
  it('starts in the initial state and notifies listeners on transition', () => {
    const subject = createSubject<Snapshot>();
    const seen: string[] = [];
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 99 }),
      now: () => 1,
    });
    bound.subscribe((s) => seen.push(s.kind));
    expect(bound.getState().kind).toBe('idle');
    bound.start();
    expect(seen).toEqual(['loading']);
    expect(bound.getState().kind).toBe('loading');
  });

  it('source emission transitions Loading → Ready with version=1', () => {
    const subject = createSubject<Snapshot>();
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
      now: () => 1,
    });
    bound.start();
    subject.next({ count: 7 });
    const s = bound.getState();
    expect(s.kind).toBe('ready');
    if (s.kind === 'ready') {
      expect(s.data.count).toBe(7);
      expect(s.version).toBe(1);
    }
  });

  it('a second emission bumps version monotonically', () => {
    const subject = createSubject<Snapshot>();
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
      now: () => 1,
    });
    bound.start();
    subject.next({ count: 1 });
    subject.next({ count: 2 });
    const s = bound.getState();
    if (s.kind === 'ready') {
      expect(s.version).toBe(2);
      expect(s.data.count).toBe(2);
    } else {
      throw new Error('expected ready');
    }
  });

  it('source error transitions to Error with at=now()', () => {
    const subject = createSubject<Snapshot>();
    const clock = makeClock(42);
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
      now: clock.now,
    });
    bound.start();
    subject.error(new Error('boom'));
    const s = bound.getState();
    expect(s.kind).toBe('error');
    if (s.kind === 'error') {
      expect(s.error.kind).toBe('load-failed');
      expect(s.error.message).toBe('boom');
      expect(s.error.at).toBe(42);
    }
  });

  it('start() is idempotent w.r.t. source subscription (only one unsub managed)', () => {
    let subscriptions = 0;
    let unsubs = 0;
    const fakeSource: Observable<Snapshot> = {
      subscribe(_o: Observer<Snapshot>): Unsubscribe {
        subscriptions += 1;
        return () => {
          unsubs += 1;
        };
      },
    };
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: fakeSource,
      mutate: async () => ({ count: 0 }),
    });
    bound.start();
    bound.start();
    bound.start();
    expect(subscriptions).toBe(1);
    bound.dispose();
    expect(unsubs).toBe(1);
  });
});

describe('bindExperience · mutation lifecycle', () => {
  it('Mutate → MutationSucceeded transitions Ready → Mutating → Ready (version bumped)', async () => {
    const subject = createSubject<Snapshot>();
    const ids = makeMutationIds();
    const seen: string[] = [];
    const bound = bindExperience<Snapshot, Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async (input) => input,
      now: () => 1,
      newMutationId: () => ids.next(),
    });
    bound.subscribe((s) => seen.push(s.kind));
    bound.start();
    subject.next({ count: 1 });
    const result = await bound.mutate({ count: 2 });
    if (result.kind === 'ready') {
      expect(result.data.count).toBe(2);
      expect(result.version).toBe(2);
    } else {
      throw new Error('expected ready');
    }
    expect(seen).toEqual(['loading', 'ready', 'mutating', 'ready']);
  });

  it('Mutate → MutationFailed (recoverable) restores the base Ready snapshot', async () => {
    const subject = createSubject<Snapshot>();
    const bound = bindExperience<Snapshot, void>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => {
        throw new Error('boom');
      },
      now: () => 1,
    });
    bound.start();
    subject.next({ count: 5 });
    const result = await bound.mutate(undefined);
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready') {
      // Same data + same version preserved across the failed mutation.
      expect(result.data.count).toBe(5);
      expect(result.version).toBe(1);
    }
  });

  it('mutate() is a no-op when there is no current Ready snapshot (illegal transition observed)', async () => {
    const subject = createSubject<Snapshot>();
    const errors: TransitionError[] = [];
    const bound = bindExperience<Snapshot, void>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
      now: () => 1,
      onTransitionError: (e) => errors.push(e),
    });
    // No start(), so state.kind === 'idle'; Mutate from idle is illegal.
    await bound.mutate(undefined);
    expect(bound.getState().kind).toBe('idle');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.kind).toBe('IllegalTransition');
  });

  it('mutate() resolves with the *next* state even on rejection', async () => {
    const subject = createSubject<Snapshot>();
    const bound = bindExperience<Snapshot, void>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => {
        throw 'string-error';
      },
      now: () => 100,
    });
    bound.start();
    subject.next({ count: 5 });
    const result = await bound.mutate(undefined);
    expect(result.kind).toBe('ready');
  });

  it('runs the user-supplied mutationId generator', async () => {
    const subject = createSubject<Snapshot>();
    let lastSeenId = '';
    const bound = bindExperience<Snapshot, void>({
      initialState: idle(ID),
      source$: subject,
      mutate: async (_in, ctx) => {
        lastSeenId = ctx.mutationId;
        return { count: 9 };
      },
      newMutationId: () => 'fixed-id',
    });
    bound.start();
    subject.next({ count: 1 });
    await bound.mutate(undefined);
    expect(lastSeenId).toBe('fixed-id');
  });
});

describe('bindExperience · reset + dispose', () => {
  it('reset() returns to Idle from any state', () => {
    const subject = createSubject<Snapshot>();
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
    });
    bound.start();
    subject.next({ count: 1 });
    expect(bound.getState().kind).toBe('ready');
    bound.reset();
    expect(bound.getState().kind).toBe('idle');
  });

  it('dispose() unsubscribes from the source and silences further events', () => {
    const subject = createSubject<Snapshot>();
    const seen: string[] = [];
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
    });
    bound.subscribe((s) => seen.push(s.kind));
    bound.start();
    bound.dispose();
    subject.next({ count: 99 });
    // No further state change after dispose.
    expect(seen).toEqual(['loading']);
  });

  it('dispose() is idempotent', () => {
    const subject = createSubject<Snapshot>();
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
    });
    bound.start();
    bound.dispose();
    expect(() => bound.dispose()).not.toThrow();
  });

  it('mutate() after dispose returns the current state without invoking the mutator', async () => {
    const subject = createSubject<Snapshot>();
    let mutatorCalls = 0;
    const bound = bindExperience<Snapshot, void>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => {
        mutatorCalls += 1;
        return { count: 0 };
      },
    });
    bound.start();
    bound.dispose();
    await bound.mutate(undefined);
    expect(mutatorCalls).toBe(0);
  });
});

describe('bindExperience · onTransitionError', () => {
  it('does not crash on illegal source emissions; reports them instead', () => {
    const subject = createSubject<Snapshot>();
    const errors: TransitionError[] = [];
    const bound = bindExperience<Snapshot>({
      initialState: idle(ID),
      source$: subject,
      mutate: async () => ({ count: 0 }),
      onTransitionError: (e) => errors.push(e),
    });
    // Skip start(): state is idle, an emit -> loaded which is illegal from idle.
    // We have to subscribe manually because bind only attaches on start().
    // Use start() then reset() then re-emit to test the illegal path.
    bound.start();
    subject.next({ count: 1 });
    bound.reset();
    // Now state is idle but the source is still wired. A second emission
    // will produce a Loaded event from Idle — an illegal transition.
    subject.next({ count: 2 });
    expect(bound.getState().kind).toBe('idle');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.at(-1)?.kind).toBe('IllegalTransition');
  });
});
