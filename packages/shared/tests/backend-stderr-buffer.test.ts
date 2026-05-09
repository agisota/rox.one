import { describe, expect, test } from 'bun:test';

import { BackendStderrBuffer } from '../src/agent/core/backend-stderr-buffer.ts';

describe('BackendStderrBuffer', () => {
  test('first occurrence of any message is emitted with repeatCount 1', () => {
    const buf = new BackendStderrBuffer();

    expect(buf.record('boom')).toEqual({ action: 'emit', repeatCount: 1 });
    expect(buf.currentMessage).toBe('boom');
    expect(buf.currentRepeatCount).toBe(1);
  });

  test('emits up to maxIdenticalRepeats consecutive identical messages, then suppresses', () => {
    const buf = new BackendStderrBuffer({ maxIdenticalRepeats: 3 });

    expect(buf.record('boom')).toEqual({ action: 'emit', repeatCount: 1 });
    expect(buf.record('boom')).toEqual({ action: 'emit', repeatCount: 2 });
    expect(buf.record('boom')).toEqual({ action: 'emit', repeatCount: 3 });
    // 4th identical message is the first one suppressed.
    expect(buf.record('boom')).toEqual({ action: 'suppress', repeatCount: 4 });
    expect(buf.record('boom')).toEqual({ action: 'suppress', repeatCount: 5 });
  });

  test('different message resets the counter and emits', () => {
    const buf = new BackendStderrBuffer({ maxIdenticalRepeats: 2 });

    buf.record('boom');
    buf.record('boom');
    // Suppression in effect for "boom".
    expect(buf.record('boom')).toEqual({ action: 'suppress', repeatCount: 3 });

    expect(buf.record('crash')).toEqual({ action: 'emit', repeatCount: 1 });
    expect(buf.currentMessage).toBe('crash');
    expect(buf.currentRepeatCount).toBe(1);
  });

  test('reset() clears state so a previously-suppressed message can re-emit', () => {
    const buf = new BackendStderrBuffer({ maxIdenticalRepeats: 1 });

    buf.record('boom');
    expect(buf.record('boom')).toEqual({ action: 'suppress', repeatCount: 2 });

    buf.reset();

    expect(buf.currentMessage).toBeNull();
    expect(buf.currentRepeatCount).toBe(0);
    expect(buf.record('boom')).toEqual({ action: 'emit', repeatCount: 1 });
  });

  test('default maxIdenticalRepeats is 3 (Pi historical threshold)', () => {
    const buf = new BackendStderrBuffer();

    expect(buf.record('x').action).toBe('emit'); // 1
    expect(buf.record('x').action).toBe('emit'); // 2
    expect(buf.record('x').action).toBe('emit'); // 3
    expect(buf.record('x').action).toBe('suppress'); // 4
  });

  test('throws on non-positive maxIdenticalRepeats', () => {
    expect(() => new BackendStderrBuffer({ maxIdenticalRepeats: 0 })).toThrow(RangeError);
    expect(() => new BackendStderrBuffer({ maxIdenticalRepeats: -1 })).toThrow(RangeError);
    expect(() => new BackendStderrBuffer({ maxIdenticalRepeats: Number.NaN })).toThrow(RangeError);
  });

  test('non-consecutive identical messages do not accumulate suppression', () => {
    const buf = new BackendStderrBuffer({ maxIdenticalRepeats: 2 });

    expect(buf.record('a').action).toBe('emit');
    expect(buf.record('b').action).toBe('emit');
    expect(buf.record('a').action).toBe('emit'); // run resets
    expect(buf.record('a').action).toBe('emit'); // run-length 2
    expect(buf.record('a').action).toBe('suppress'); // run-length 3
  });
});
