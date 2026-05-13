import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { __resetEnvCompatWarningsForTests, readEnv } from '../env-compat.ts';

function captureStderrWrites() {
  const writes: string[] = [];
  // The shim emits its deprecation warning via `console.warn`, which Bun
  // routes through both the global `console` and `process.stderr.write`.
  // Spying on both surfaces lets the test run identically under Bun's test
  // runner (which intercepts `console.warn`) and under a plain Node host.
  const warnSpy = spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    writes.push(args.map((arg) => String(arg)).join(' '));
  });
  const writeSpy = spyOn(process.stderr, 'write').mockImplementation(
    (chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    },
  );

  return {
    writes,
    restore: () => {
      warnSpy.mockRestore();
      writeSpy.mockRestore();
    },
  };
}

describe('readEnv', () => {
  const SAVED_ROX_FOO = process.env.ROX_FOO;
  const SAVED_CRAFT_FOO = process.env.CRAFT_FOO;
  const SAVED_ROX_BAR = process.env.ROX_BAR;
  const SAVED_CRAFT_BAR = process.env.CRAFT_BAR;

  beforeEach(() => {
    delete process.env.ROX_FOO;
    delete process.env.CRAFT_FOO;
    delete process.env.ROX_BAR;
    delete process.env.CRAFT_BAR;
    __resetEnvCompatWarningsForTests();
  });

  afterEach(() => {
    if (SAVED_ROX_FOO === undefined) delete process.env.ROX_FOO;
    else process.env.ROX_FOO = SAVED_ROX_FOO;
    if (SAVED_CRAFT_FOO === undefined) delete process.env.CRAFT_FOO;
    else process.env.CRAFT_FOO = SAVED_CRAFT_FOO;
    if (SAVED_ROX_BAR === undefined) delete process.env.ROX_BAR;
    else process.env.ROX_BAR = SAVED_ROX_BAR;
    if (SAVED_CRAFT_BAR === undefined) delete process.env.CRAFT_BAR;
    else process.env.CRAFT_BAR = SAVED_CRAFT_BAR;
    __resetEnvCompatWarningsForTests();
  });

  test('returns undefined when neither new nor legacy is set', () => {
    const capture = captureStderrWrites();
    try {
      expect(readEnv('ROX_FOO')).toBeUndefined();
      expect(capture.writes.join('')).not.toContain('CRAFT_FOO');
    } finally {
      capture.restore();
    }
  });

  test('returns the new value when ROX_* is set', () => {
    process.env.ROX_FOO = 'new-value';
    const capture = captureStderrWrites();
    try {
      expect(readEnv('ROX_FOO')).toBe('new-value');
      expect(capture.writes.join('')).not.toContain('CRAFT_FOO');
    } finally {
      capture.restore();
    }
  });

  test('returns the legacy value and warns when only CRAFT_* is set', () => {
    process.env.CRAFT_FOO = 'legacy-value';
    const capture = captureStderrWrites();
    try {
      expect(readEnv('ROX_FOO')).toBe('legacy-value');
      const stderr = capture.writes.join('');
      expect(stderr).toContain('CRAFT_FOO is deprecated');
      expect(stderr).toContain('ROX_FOO');
    } finally {
      capture.restore();
    }
  });

  test('warns exactly once per legacy var per process', () => {
    process.env.CRAFT_FOO = 'legacy-value';
    const capture = captureStderrWrites();
    try {
      expect(readEnv('ROX_FOO')).toBe('legacy-value');
      expect(readEnv('ROX_FOO')).toBe('legacy-value');
      expect(readEnv('ROX_FOO')).toBe('legacy-value');
      const stderr = capture.writes.join('');
      const occurrences = stderr.split('CRAFT_FOO is deprecated').length - 1;
      expect(occurrences).toBe(1);
    } finally {
      capture.restore();
    }
  });

  test('warns separately for each distinct legacy var', () => {
    process.env.CRAFT_FOO = 'legacy-foo';
    process.env.CRAFT_BAR = 'legacy-bar';
    const capture = captureStderrWrites();
    try {
      expect(readEnv('ROX_FOO')).toBe('legacy-foo');
      expect(readEnv('ROX_BAR')).toBe('legacy-bar');
      const stderr = capture.writes.join('');
      expect(stderr).toContain('CRAFT_FOO is deprecated');
      expect(stderr).toContain('CRAFT_BAR is deprecated');
    } finally {
      capture.restore();
    }
  });

  test('prefers the new value over the legacy value and does not warn', () => {
    process.env.ROX_FOO = 'new-value';
    process.env.CRAFT_FOO = 'legacy-value';
    const capture = captureStderrWrites();
    try {
      expect(readEnv('ROX_FOO')).toBe('new-value');
      const stderr = capture.writes.join('');
      expect(stderr).not.toContain('CRAFT_FOO is deprecated');
    } finally {
      capture.restore();
    }
  });
});
