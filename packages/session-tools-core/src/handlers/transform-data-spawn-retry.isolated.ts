import { afterEach, describe, expect, mock, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionToolContext } from '../context.ts';

const fs = await import('node:fs');
const childProcess = await import('node:child_process');
const realReadFileSync = fs.readFileSync;
const realSpawn = childProcess.spawn;

let nextSpawnError: (Error & { code?: string; syscall?: string }) | undefined;
let remainingSpawnErrors = 0;
let failPipeStdio = false;
let failCaptureReads = false;
let spawnCalls = 0;

const mockedSpawn = ((...args: unknown[]) => {
  spawnCalls += 1;
  const options = args[2] as { stdio?: unknown } | undefined;
  if (failPipeStdio && Array.isArray(options?.stdio) && options.stdio.includes('pipe')) {
    throw transientSpawnError('EBADF');
  }
  if (nextSpawnError && remainingSpawnErrors > 0) {
    const error = nextSpawnError;
    remainingSpawnErrors -= 1;
    if (remainingSpawnErrors === 0) {
      nextSpawnError = undefined;
    }
    throw error;
  }
  return (realSpawn as unknown as (...spawnArgs: unknown[]) => ReturnType<typeof realSpawn>)(...args);
}) as typeof childProcess.spawn;

mock.module('node:child_process', () => ({
  ...childProcess,
  spawn: mockedSpawn,
}));

mock.module('node:fs', () => ({
  ...fs,
  readFileSync: ((path: Parameters<typeof fs.readFileSync>[0], ...args: unknown[]) => {
    if (failCaptureReads && String(path).includes('.transform-stdio-')) {
      const error = new Error(`forced capture read failure for ${String(path)}`) as Error & { code: string };
      error.code = 'EIO';
      throw error;
    }
    return (realReadFileSync as unknown as (...readArgs: unknown[]) => unknown)(path, ...args);
  }) as typeof fs.readFileSync,
}));

const { handleTransformData } = await import('./transform-data.ts');

function transientSpawnError(code: string): Error & { code: string; syscall: string } {
  const error = new Error(`${code}: transient spawn startup failure`) as Error & {
    code: string;
    syscall: string;
  };
  error.code = code;
  error.syscall = 'epoll_ctl';
  return error;
}

describe('transform_data transient spawn retry', () => {
  let rootDir: string;
  let sessionDir: string;
  let dataDir: string;

  afterEach(() => {
    nextSpawnError = undefined;
    remainingSpawnErrors = 0;
    failPipeStdio = false;
    failCaptureReads = false;
    spawnCalls = 0;
    if (rootDir) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  function setupContext(): SessionToolContext {
    rootDir = mkdtempSync(join(tmpdir(), 'transform-data-spawn-retry-'));
    sessionDir = join(rootDir, 'session');
    dataDir = join(sessionDir, 'data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(sessionDir, 'in.txt'), 'hello');

    return {
      sessionId: 'spawn-retry-session',
      workspacePath: rootDir,
      sourcesPath: join(rootDir, 'sources'),
      skillsPath: join(rootDir, 'skills'),
      plansFolderPath: join(sessionDir, 'plans'),
      callbacks: {
        onPlanSubmitted: () => {},
        onAuthRequest: () => {},
      },
      loadSourceConfig: () => null,
      fs: {
        exists: () => false,
        readFile: () => '',
        readFileBuffer: () => Buffer.from(''),
        writeFile: () => {},
        isDirectory: () => false,
        readdir: () => [],
        stat: () => ({ size: 0, isDirectory: () => false }),
      },
      sessionPath: sessionDir,
      dataPath: dataDir,
    };
  }

  test('retries a transient EBADF spawn startup failure and writes output', async () => {
    nextSpawnError = transientSpawnError('EBADF');
    remainingSpawnErrors = 1;

    const result = await handleTransformData(setupContext(), {
      language: 'node',
      script: "const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1), JSON.stringify({ok:true}));",
      inputFiles: ['in.txt'],
      outputFile: 'out.json',
    });

    expect(result.isError).toBe(false);
    expect(spawnCalls).toBe(2);
    expect(existsSync(join(dataDir, 'out.json'))).toBe(true);
  });

  test('retries a short transient EBADF burst and writes output', async () => {
    nextSpawnError = transientSpawnError('EBADF');
    remainingSpawnErrors = 3;

    const result = await handleTransformData(setupContext(), {
      language: 'node',
      script: "const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1), JSON.stringify({ok:true}));",
      inputFiles: ['in.txt'],
      outputFile: 'out.json',
    });

    expect(result.isError).toBe(false);
    expect(spawnCalls).toBe(4);
    expect(existsSync(join(dataDir, 'out.json'))).toBe(true);
  });

  test('does not depend on child-process pipe stdio for hosted Bun startup', async () => {
    failPipeStdio = true;

    const result = await handleTransformData(setupContext(), {
      language: 'node',
      script: "const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1), JSON.stringify({ok:true}));",
      inputFiles: ['in.txt'],
      outputFile: 'out.json',
    });

    expect(result.isError).toBe(false);
    expect(spawnCalls).toBe(1);
    expect(existsSync(join(dataDir, 'out.json'))).toBe(true);
  });

  test('does not retry non-transient spawn startup errors', async () => {
    nextSpawnError = transientSpawnError('EACCES');
    remainingSpawnErrors = 1;

    const result = await handleTransformData(setupContext(), {
      language: 'node',
      script: "const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1), JSON.stringify({ok:true}));",
      inputFiles: ['in.txt'],
      outputFile: 'out.json',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('EACCES: transient spawn startup failure');
    expect(spawnCalls).toBe(1);
    expect(existsSync(join(dataDir, 'out.json'))).toBe(false);
  });

  test('preserves stderr from non-zero transform scripts', async () => {
    const result = await handleTransformData(setupContext(), {
      language: 'node',
      script: "process.stderr.write('transform failed with details'); process.exit(7);",
      inputFiles: ['in.txt'],
      outputFile: 'out.json',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Script failed (exit code 7)');
    expect(result.content[0]?.text).toContain('transform failed with details');
    expect(result.content[0]?.text).not.toContain('Script exited with non-zero code');
  });

  test('surfaces capture read failures instead of hiding script diagnostics', async () => {
    failCaptureReads = true;

    const result = await handleTransformData(setupContext(), {
      language: 'node',
      script: "process.stderr.write('transform failed with details'); process.exit(7);",
      inputFiles: ['in.txt'],
      outputFile: 'out.json',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Script failed (exit code 7)');
    expect(result.content[0]?.text).toContain('Failed to read stderr capture');
    expect(result.content[0]?.text).toContain('forced capture read failure');
    expect(result.content[0]?.text).not.toContain('Script exited with non-zero code');
  });
});
