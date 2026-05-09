import { describe, expect, test } from 'bun:test';

import { PendingRequestMap } from '../src/agent/core/pending-request-map.ts';

describe('PendingRequestMap', () => {
  test('register + resolve settles the promise and drops the entry', async () => {
    const map = new PendingRequestMap<string>();
    const result = await new Promise<string>((resolve, reject) => {
      map.register('req-1', resolve, reject);
      // Simulate a response arriving on the wire.
      queueMicrotask(() => {
        map.resolve('req-1', 'ok');
      });
    });

    expect(result).toBe('ok');
    expect(map.size).toBe(0);
    expect(map.has('req-1')).toBe(false);
  });

  test('register + reject settles the promise with the given error', async () => {
    const map = new PendingRequestMap<string>();
    const promise = new Promise<string>((resolve, reject) => {
      map.register('req-2', resolve, reject);
    });

    map.reject('req-2', new Error('boom'));
    await expect(promise).rejects.toThrow('boom');
    expect(map.size).toBe(0);
  });

  test('resolve / reject return false when the id is unknown', () => {
    const map = new PendingRequestMap<number>();
    expect(map.resolve('missing', 42)).toBe(false);
    expect(map.reject('missing', new Error('x'))).toBe(false);
  });

  test('resolve drops the entry so a duplicate response is a no-op', async () => {
    const map = new PendingRequestMap<string>();
    const promise = new Promise<string>((resolve, reject) => {
      map.register('req-3', resolve, reject);
    });

    expect(map.resolve('req-3', 'first')).toBe(true);
    expect(map.resolve('req-3', 'second')).toBe(false); // late duplicate ignored
    expect(map.reject('req-3', new Error('late'))).toBe(false); // late reject ignored

    await expect(promise).resolves.toBe('first');
  });

  test('rejectAll settles every outstanding entry and clears the map', async () => {
    const map = new PendingRequestMap<number>();
    const a = new Promise<number>((resolve, reject) => {
      map.register('a', resolve, reject);
    });
    const b = new Promise<number>((resolve, reject) => {
      map.register('b', resolve, reject);
    });
    const c = new Promise<number>((resolve, reject) => {
      map.register('c', resolve, reject);
    });

    expect(map.size).toBe(3);
    map.rejectAll(new Error('subprocess exit'));
    expect(map.size).toBe(0);

    await expect(a).rejects.toThrow('subprocess exit');
    await expect(b).rejects.toThrow('subprocess exit');
    await expect(c).rejects.toThrow('subprocess exit');
  });

  test('resolveAll settles every outstanding entry to the sentinel value and clears the map', async () => {
    const map = new PendingRequestMap<boolean>();
    const a = new Promise<boolean>((resolve, reject) => {
      map.register('a', resolve, reject);
    });
    const b = new Promise<boolean>((resolve, reject) => {
      map.register('b', resolve, reject);
    });

    expect(map.size).toBe(2);
    map.resolveAll(false); // permission-deny semantics
    expect(map.size).toBe(0);

    await expect(a).resolves.toBe(false);
    await expect(b).resolves.toBe(false);
  });

  test('rejectAll snapshot prevents re-entrant settle from observing stale entries', () => {
    const map = new PendingRequestMap<number>();

    let observedSizeDuringReject = -1;
    const observingReject = (_err: Error) => {
      observedSizeDuringReject = map.size;
    };

    map.register('a', () => {}, observingReject);
    map.register('b', () => {}, () => {});

    map.rejectAll(new Error('teardown'));

    // The first rejection callback ran AFTER the map was cleared, so it
    // observed size 0 (snapshot semantics).
    expect(observedSizeDuringReject).toBe(0);
    expect(map.size).toBe(0);
  });

  test('attaches per-entry metadata via the M type parameter', () => {
    type Meta = { toolName: string };
    const map = new PendingRequestMap<boolean, Meta>();

    map.register('perm-1', () => {}, () => {}, { toolName: 'Bash' });
    map.register('perm-2', () => {}, () => {}, { toolName: 'Read' });

    expect(map.getMeta('perm-1')).toEqual({ toolName: 'Bash' });
    expect(map.getMeta('perm-2')).toEqual({ toolName: 'Read' });
    expect(map.getMeta('missing')).toBeUndefined();
  });

  test('getMeta after settle returns undefined', () => {
    type Meta = { toolName: string };
    const map = new PendingRequestMap<boolean, Meta>();
    map.register('perm-1', () => {}, () => {}, { toolName: 'Bash' });

    expect(map.resolve('perm-1', true)).toBe(true);
    expect(map.getMeta('perm-1')).toBeUndefined();
  });

  test('has() reports outstanding ids correctly', () => {
    const map = new PendingRequestMap<string>();
    expect(map.has('a')).toBe(false);
    map.register('a', () => {}, () => {});
    expect(map.has('a')).toBe(true);
    map.resolve('a', 'done');
    expect(map.has('a')).toBe(false);
  });
});
