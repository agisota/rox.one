/** Tests for `experience-bind` — M.9 T270. */
import { describe, it, expect } from 'bun:test';
import {
  bindExperience,
  createSubject,
  type Observable,
  type Observer,
  type Unsubscribe,
  type BindOptions,
} from '../experience-bind.ts';
import { idle } from '../experience-state.ts';
import { unsafeExperienceId } from '../experience-id.ts';
import type { TransitionError } from '../experience-reducer.ts';

interface Snapshot { readonly count: number }
const ID = unsafeExperienceId('0190a4d2-1234-7abc-89de-0123456789ab');

function make<MIn = void>(opts?: Partial<BindOptions<Snapshot, MIn>>) {
  const subject = createSubject<Snapshot>();
  const bound = bindExperience<Snapshot, MIn>({
    initialState: idle(ID),
    source$: subject,
    mutate: async () => ({ count: 0 }),
    now: () => 1,
    ...opts,
  });
  return { subject, bound };
}

describe('bindExperience · subscribe + start', () => {
  it('starts in initial state and notifies listeners on transition', () => {
    const { bound } = make();
    const seen: string[] = [];
    bound.subscribe((s) => seen.push(s.kind));
    expect(bound.getState().kind).toBe('idle');
    bound.start();
    expect(seen).toEqual(['loading']);
    expect(bound.getState().kind).toBe('loading');
  });

  it('source emission transitions Loading → Ready (version=1)', () => {
    const { subject, bound } = make();
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
    const { subject, bound } = make();
    bound.start();
    subject.next({ count: 1 });
    subject.next({ count: 2 });
    const s = bound.getState();
    if (s.kind === 'ready') {
      expect(s.version).toBe(2);
      expect(s.data.count).toBe(2);
    } else throw new Error('expected ready');
  });

  it('source error transitions to Error with at=now()', () => {
    const { subject, bound } = make({ now: () => 42 });
    bound.start();
    subject.error(new Error('boom'));
    const s = bound.getState();
    if (s.kind !== 'error') throw new Error('expected error');
    expect(s.error.kind).toBe('load-failed');
    expect(s.error.message).toBe('boom');
    expect(s.error.at).toBe(42);
  });

  it('start() does not double-subscribe to the source', () => {
    let subs = 0;
    let unsubs = 0;
    const fakeSource: Observable<Snapshot> = {
      subscribe: (_o: Observer<Snapshot>): Unsubscribe => {
        subs += 1;
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
    expect(subs).toBe(1);
    bound.dispose();
    expect(unsubs).toBe(1);
  });
});

describe('bindExperience · mutation lifecycle', () => {
  it('Mutate → MutationSucceeded: Ready → Mutating → Ready (version bumped)', async () => {
    const { subject, bound } = make<Snapshot>({
      mutate: async (input) => input,
      newMutationId: () => 'm1',
    });
    const seen: string[] = [];
    bound.subscribe((s) => seen.push(s.kind));
    bound.start();
    subject.next({ count: 1 });
    const result = await bound.mutate({ count: 2 });
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.data.count).toBe(2);
    expect(result.version).toBe(2);
    expect(seen).toEqual(['loading', 'ready', 'mutating', 'ready']);
  });

  it('Mutate → MutationFailed (recoverable) restores the base Ready snapshot', async () => {
    const { subject, bound } = make<void>({
      mutate: async () => {
        throw new Error('boom');
      },
    });
    bound.start();
    subject.next({ count: 5 });
    const result = await bound.mutate(undefined);
    if (result.kind !== 'ready') throw new Error('expected ready');
    expect(result.data.count).toBe(5);
    expect(result.version).toBe(1);
  });

  it('mutate() is a no-op when there is no current Ready snapshot', async () => {
    const errors: TransitionError[] = [];
    const { bound } = make<void>({ onTransitionError: (e) => errors.push(e) });
    await bound.mutate(undefined);
    expect(bound.getState().kind).toBe('idle');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.kind).toBe('IllegalTransition');
  });

  it('mutate() resolves with the next state even on string-throw rejection', async () => {
    const { subject, bound } = make<void>({
      mutate: async () => {
        throw 'string-error';
      },
      now: () => 100,
    });
    bound.start();
    subject.next({ count: 5 });
    expect((await bound.mutate(undefined)).kind).toBe('ready');
  });

  it('runs the user-supplied mutationId generator', async () => {
    let lastSeenId = '';
    const { subject, bound } = make<void>({
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
    const { subject, bound } = make();
    bound.start();
    subject.next({ count: 1 });
    expect(bound.getState().kind).toBe('ready');
    bound.reset();
    expect(bound.getState().kind).toBe('idle');
  });

  it('dispose() unsubscribes from the source and silences further events', () => {
    const { subject, bound } = make();
    const seen: string[] = [];
    bound.subscribe((s) => seen.push(s.kind));
    bound.start();
    bound.dispose();
    subject.next({ count: 99 });
    expect(seen).toEqual(['loading']);
  });

  it('dispose() is idempotent', () => {
    const { bound } = make();
    bound.start();
    bound.dispose();
    expect(() => bound.dispose()).not.toThrow();
  });

  it('mutate() after dispose returns state without invoking the mutator', async () => {
    let mutatorCalls = 0;
    const { bound } = make<void>({
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
  it('reports illegal source emissions without mutating state', () => {
    const errors: TransitionError[] = [];
    const { subject, bound } = make({ onTransitionError: (e) => errors.push(e) });
    bound.start();
    subject.next({ count: 1 });
    bound.reset();
    // State is idle but source still wired; second emission → Loaded from Idle (illegal).
    subject.next({ count: 2 });
    expect(bound.getState().kind).toBe('idle');
    expect(errors.at(-1)?.kind).toBe('IllegalTransition');
  });
});
