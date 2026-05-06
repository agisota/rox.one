#!/usr/bin/env bun
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'bun';

const ROOT_DIR = path.join(import.meta.dir, '..');
const LOG_DIR = path.join(ROOT_DIR, '.e2e-logs');

interface Scenario {
  id: string;
  title: string;
  command: string[];
  timeoutMs?: number;
}

const scenarios: Scenario[] = [
  {
    id: 'composer-artifacts',
    title: 'Composer actions open in-app artifacts',
    command: [
      'bun',
      'test',
      'apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts',
      'apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx',
    ],
  },
  {
    id: 'experience-runtime-journey',
    title: 'Experience runtime journey stays fake-provider-safe and replayable',
    command: ['bun', 'test', 'packages/shared/src/workbench/__tests__/experience-layer-e2e-scenario.test.ts'],
  },
  {
    id: 'account-team-billing-storage',
    title: 'Account, teams, billing, and storage stay tenant-scoped with fake providers',
    command: [
      'bun',
      'test',
      'apps/electron/src/renderer/pages/settings/__tests__/account-auth-panel.test.tsx',
      'packages/server-core/src/webui/__tests__/account-teams.test.ts',
      'packages/server-core/src/webui/__tests__/account-billing.test.ts',
      'packages/server-core/src/storage/__tests__/object-storage.test.ts',
    ],
  },
  {
    id: 'server-smoke',
    title: 'Headless server accepts valid token and rejects invalid token',
    command: ['bun', 'test', 'packages/server/src/__tests__/smoke.test.ts'],
    timeoutMs: 60_000,
  },
  {
    id: 'electron-startup-smoke',
    title: 'Electron headless startup reaches ready markers',
    command: ['bun', 'run', 'electron:smoke'],
    timeoutMs: 90_000,
  },
];

function redact(text: string): string {
  return text
    .replace(/ROX_SERVER_TOKEN=\S+/g, 'ROX_SERVER_TOKEN=[REDACTED]')
    .replace(/ROX_SERVER_URL=\S+/g, 'ROX_SERVER_URL=[REDACTED]');
}

async function runScenario(scenario: Scenario): Promise<void> {
  const startedAt = Date.now();
  const logPath = path.join(LOG_DIR, `${scenario.id}.log`);
  const proc = spawn({
    cmd: scenario.command,
    cwd: ROOT_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      ROX_E2E_FAKE_PROVIDERS: '1',
      ROX_HEADLESS: '1',
    },
  });

  let output = '';
  const collect = async (stream: ReadableStream<Uint8Array> | null) => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = redact(decoder.decode(value, { stream: true }));
      output += text;
      process.stdout.write(text);
    }
  };

  let timedOut = false;
  const timeout = scenario.timeoutMs
    ? setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, scenario.timeoutMs)
    : undefined;

  const stdoutTask = collect(proc.stdout);
  const stderrTask = collect(proc.stderr);
  const exitCode = await proc.exited;
  if (timeout) clearTimeout(timeout);
  await Promise.allSettled([stdoutTask, stderrTask]);

  const elapsedMs = Date.now() - startedAt;
  writeFileSync(logPath, output, 'utf8');

  if (timedOut) {
    throw new Error(`${scenario.id} timed out after ${scenario.timeoutMs}ms`);
  }
  if (exitCode !== 0) {
    throw new Error(`${scenario.id} exited with code ${exitCode}; log=${logPath}`);
  }

  console.log(`[e2e-core] pass ${scenario.id} (${elapsedMs}ms)`);
}

mkdirSync(LOG_DIR, { recursive: true });
console.log(`[e2e-core] running ${scenarios.length} core scenarios with fake providers`);

const failures: string[] = [];
for (const scenario of scenarios) {
  console.log(`[e2e-core] start ${scenario.id}: ${scenario.title}`);
  try {
    await runScenario(scenario);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${scenario.id}: ${message}`);
    console.error(`[e2e-core] fail ${scenario.id}: ${message}`);
    break;
  }
}

if (failures.length > 0) {
  console.error(`[e2e-core] failed:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('[e2e-core] all core scenarios passed');
