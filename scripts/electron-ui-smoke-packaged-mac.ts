#!/usr/bin/env bun
import { spawn } from 'bun';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const DEFAULT_APP_PATH = join(ROOT_DIR, 'apps/electron/release/mac-arm64/ROX.ONE.app');
const APP_PATH = process.env.ROX_MAC_APP_PATH || DEFAULT_APP_PATH;
const EXECUTABLE_PATH = join(APP_PATH, 'Contents/MacOS/ROX.ONE');
const DEBUG_PORT = Number(process.env.ROX_UI_SMOKE_DEBUG_PORT || String(9338 + Math.floor(Math.random() * 500)));
const STARTUP_TIMEOUT_MS = 45_000;
const WAIT_TIMEOUT_MS = 30_000;
const FORCE_KILL_GRACE_MS = 5_000;
const EVIDENCE_DIR = process.env.ROX_UI_SMOKE_EVIDENCE_DIR
  || join(homedir(), '.ai-agent-hub/evidence/playwright-smoke', `rox-one-ui-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`);

const EXPERIENCE_SCREENS = [
  ['deep-missions', 'Долгие миссии'],
  ['arena-builder', 'Арена агентов'],
  ['mission-control', 'Центр миссий'],
  ['progression', 'Прогресс'],
  ['quest-map', 'Карта квестов'],
  ['agent-forge', 'Кузница агентов'],
] as const;

const COMPOSER_ACTIONS = [
  { id: 'improve-prompt', wrapperId: 'improve-prompt', expected: 'Улучшить запрос', overflow: false },
  { id: 'run-tdd-plan', wrapperId: 'tdd-plan', expected: 'TDD план', overflow: false },
  { id: 'verify', wrapperId: 'verify', expected: 'Проверить', overflow: false },
  { id: 'tear-down', wrapperId: 'tear-down', expected: 'Разъебать', overflow: true },
  { id: 'build-spec', wrapperId: 'spec', expected: 'Собрать ТЗ', overflow: true },
  { id: 'review', wrapperId: 'review', expected: 'Ревью', overflow: true },
] as const;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

if (process.platform !== 'darwin') {
  fail('Packaged macOS UI smoke must run on darwin');
}

if (!existsSync(EXECUTABLE_PATH)) {
  fail(`Missing packaged app executable: ${EXECUTABLE_PATH}`);
}

mkdirSync(EVIDENCE_DIR, { recursive: true });
const smokeStartedAtMs = Date.now();
const userDataDir = mkdtempSync(join(tmpdir(), 'rox-one-ui-smoke-user-data-'));
const configDir = mkdtempSync(join(tmpdir(), 'rox-one-ui-smoke-config-'));

const appProc = spawn({
  cmd: [
    EXECUTABLE_PATH,
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
  ],
  cwd: ROOT_DIR,
  stdout: 'pipe',
  stderr: 'pipe',
  env: {
    ...process.env,
    ROX_E2E: '1',
    ROX_E2E_FAKE_PROVIDERS: '1',
    ROX_SMOKE_USER_DATA_DIR: userDataDir,
    // Keep the packaged app identity intact while preventing live update installs
    // from racing the UI smoke. The updater already treats this flag as a
    // dev-runtime guard in packaged verification runs.
    ROX_ELECTRON_DEV_RUNTIME: '1',
    ROX_CONFIG_DIR: configDir,
  },
});

const stdoutCapture = captureOutput(appProc.stdout, 'app-stdout.log');
const stderrCapture = captureOutput(appProc.stderr, 'app-stderr.log');

let forceKillTimer: ReturnType<typeof setTimeout> | undefined;

try {
  const target = await waitForPageTarget(DEBUG_PORT, STARTUP_TIMEOUT_MS);
  const client = await CdpClient.connect(target.webSocketDebuggerUrl);
  await client.send('Runtime.enable');
  await client.send('Page.enable');
  await waitForAppShell(client);
  await waitForNavigationReady(client);

  await runAccountSmoke(client);
  await runExperienceSmoke(client);
  await runComposerSmoke(client);

  client.close();
  console.log(`[ui-smoke] packaged ROX.ONE UI smoke passed; evidence: ${EVIDENCE_DIR}`);
} catch (error) {
  console.error(`[ui-smoke] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  appProc.kill('SIGTERM');
  forceKillTimer = setTimeout(() => appProc.kill('SIGKILL'), FORCE_KILL_GRACE_MS);
  await appProc.exited.catch(() => undefined);
  if (forceKillTimer) clearTimeout(forceKillTimer);
  await Promise.allSettled([stdoutCapture, stderrCapture]);
  copyMainLogEvidence();
  rmSync(userDataDir, { force: true, recursive: true });
  rmSync(configDir, { force: true, recursive: true });
}

async function runAccountSmoke(client: CdpClient) {
  await navigate(client, 'settings/account');
  await waitForText(client, 'Личный кабинет', 'account shell');
  await waitForText(client, 'ROX ID', 'ROX ID heading');
  await clickTab(client, 'Регистрация');
  await waitForText(client, 'Имя в профиле', 'registration form');
  await waitForText(client, 'Создать аккаунт', 'registration submit label');
  await clickTab(client, 'Сброс пароля');
  await waitForText(client, 'Восстановление доступа', 'password reset form');
  await waitForText(client, 'Отправить ссылку', 'password reset submit label');
  await clickTab(client, 'Вход');
  await waitForText(client, 'Вход в кабинет', 'sign-in form');
  await screenshot(client, 'account-auth.png');
  console.log('[ui-smoke] account tabs/forms OK');
}

async function runExperienceSmoke(client: CdpClient) {
  for (const [screen, label] of EXPERIENCE_SCREENS) {
    await navigate(client, `workbench/${screen}`);
    await waitForEval(
      client,
      `document.querySelector('[data-workbench-screen="${screen}"]') !== null`,
      `workbench screen ${screen}`,
    );
    await waitForText(client, label, `experience label ${label}`);
  }
  await navigate(client, 'workbench/deep-missions');
  await screenshot(client, 'experience-deep-missions.png');
  await navigate(client, 'workbench/agent-forge');
  await screenshot(client, 'experience-agent-forge.png');
  console.log('[ui-smoke] experience six-tab navigation OK');
}

async function runComposerSmoke(client: CdpClient) {
  const promptBase = [
    'Собери production-ready план для проверки регистрации, Experience Layer и Composer Toolbar.',
    'Нужны конкретные проверки, риски и минимальный порядок исполнения.',
  ].join(' ');

  for (const action of COMPOSER_ACTIONS) {
    const marker = `ui-smoke-${action.id}-${Date.now()}`;
    const prompt = `${promptBase} Маркер проверки: ${marker}.`;

    await navigate(client, `action/new-session?input=${encodeURIComponent(prompt)}`);
    await waitForEval(
      client,
      "document.querySelector('[data-testid=\"product-mode-toolbar\"]') !== null",
      `composer toolbar for ${action.id}`,
    );
    await waitForText(client, marker, `prefilled composer input for ${action.id}`);

    if (action.overflow) {
      await clickSelector(client, '[data-testid="product-mode-action-overflow"]', 'composer overflow button');
      await waitForEval(
        client,
        `document.querySelector('[role="menu"] [data-product-mode-action="${action.id}"]') !== null`,
        `overflow action ${action.id}`,
      );
      await clickSelector(client, `[role="menu"] [data-product-mode-action="${action.id}"]`, `composer action ${action.id}`);
    } else {
      await clickSelector(client, `[data-product-mode-action="${action.id}"]`, `composer action ${action.id}`);
    }

    const quickCommand = `Быстрая команда: ${action.wrapperId}`;
    await waitForEval(
      client,
      [
        `document.body && document.body.innerText.includes(${JSON.stringify(action.expected)})`,
        `document.body && document.body.innerText.includes(${JSON.stringify(quickCommand)})`,
        `document.body && document.body.innerText.includes(${JSON.stringify(marker)})`,
      ].join(' && '),
      `submitted quick-action wrapper for ${action.id}`,
    );

    if (action.id === 'improve-prompt' || action.id === 'build-spec') {
      await screenshot(client, `composer-${action.id}.png`);
    }
  }

  console.log('[ui-smoke] composer primary and overflow quick actions OK');
}

async function navigate(client: CdpClient, route: string) {
  await client.evaluate<boolean>(`
    window.dispatchEvent(new CustomEvent('rox-agent-navigate', {
      detail: { route: ${JSON.stringify(route)} },
      bubbles: true
    }));
    true
  `);

  if (!route.startsWith('action/')) {
    await waitForRoute(client, route, `route ${route}`);
  } else {
    await sleep(500);
  }
}

async function waitForNavigationReady(client: CdpClient) {
  await waitForEval(
    client,
    `new URLSearchParams(window.location.search).has('route') || new URLSearchParams(window.location.search).has('panels')`,
    'initial navigation route',
    15_000,
  );
}

async function waitForRoute(client: CdpClient, route: string, description: string) {
  await waitForEval(
    client,
    `new URLSearchParams(window.location.search).get('route') === ${JSON.stringify(route)}`,
    description,
    15_000,
  );
}

async function waitForAppShell(client: CdpClient) {
  const startedAt = Date.now();
  let lastText = '';

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    lastText = await client.evaluate<string>('document.body ? document.body.innerText : ""').catch(() => '');
    if (lastText.includes('Новая сессия') && lastText.includes('Настройки')) {
      return;
    }

    if (lastText.includes('Добро пожаловать') && lastText.includes('Настроить позже')) {
      await client.evaluate<boolean>(`
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const skip = buttons.find((element) => (element.textContent || '').includes('Настроить позже'));
          if (!skip) return false;
          skip.click();
          return true;
        })()
      `).catch(() => false);
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for application shell.\nVisible text:\n${lastText.slice(0, 2000)}`);
}

async function waitForText(client: CdpClient, text: string, description: string) {
  await waitForEval(
    client,
    `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
    description,
  );
}

async function clickTab(client: CdpClient, label: string) {
  await clickByExpression(client, `
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    return tabs.find((element) => (element.textContent || '').trim() === ${JSON.stringify(label)});
  `, `tab ${label}`);
}

async function clickButtonExact(client: CdpClient, label: string) {
  await clickByExpression(client, `
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((element) => (element.textContent || '').trim() === ${JSON.stringify(label)});
  `, `button ${label}`);
}

async function clickSelector(client: CdpClient, selector: string, description: string) {
  await clickByExpression(client, `return document.querySelector(${JSON.stringify(selector)});`, description);
}

async function clickByExpression(client: CdpClient, body: string, description: string) {
  await client.evaluate<boolean>(`
    (() => {
      const element = (() => { ${body} })();
      if (!element) throw new Error('Missing clickable target: ${escapeForJs(description)}');
      element.scrollIntoView({ block: 'center', inline: 'center' });
      element.click();
      return true;
    })()
  `);
  await sleep(150);
}

async function screenshot(client: CdpClient, fileName: string) {
  const result = await client.send<{ data: string }>('Page.captureScreenshot', {
    captureBeyondViewport: true,
    format: 'png',
    fromSurface: true,
  });
  writeFileSync(join(EVIDENCE_DIR, fileName), Buffer.from(result.data, 'base64'));
}

async function waitForEval(client: CdpClient, expression: string, description: string, timeoutMs = WAIT_TIMEOUT_MS) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await client.evaluate<boolean>(`Boolean(${expression})`, Math.min(10_000, timeoutMs));
      if (result) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }

  const body = await client.evaluate<string>('document.body ? document.body.innerText.slice(0, 2000) : ""').catch(() => '');
  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out waiting for ${description}.${suffix}\nVisible text:\n${body}`);
}

async function waitForPageTarget(port: number, timeoutMs: number): Promise<{ webSocketDebuggerUrl: string }> {
  const startedAt = Date.now();
  const endpoint = `http://127.0.0.1:${port}/json/list`;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const targets = await response.json() as Array<{ type?: string; title?: string; url?: string; webSocketDebuggerUrl?: string }>;
        const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl && (
          target.title === 'ROX.ONE' || target.url?.includes('index.html')
        ));
        if (page?.webSocketDebuggerUrl) {
          return { webSocketDebuggerUrl: page.webSocketDebuggerUrl };
        }
      }
    } catch {
      // The remote debugging endpoint starts shortly after Electron creates the browser window.
    }
    await sleep(250);
  }

  throw new Error(`Timed out waiting for packaged app DevTools target on ${endpoint}`);
}

class CdpClient {
  private nextId = 1;
  private pending = new Map<number, {
    reject: (error: Error) => void;
    resolve: (value: JsonValue) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener('message', (event) => {
      void this.handleMessage(event);
    });
    this.socket.addEventListener('close', () => {
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('CDP socket closed'));
      }
      this.pending.clear();
    });
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const timeout = setTimeout(() => {
        socket.close();
        reject(new Error('Timed out connecting to CDP socket'));
      }, 10_000);

      socket.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve(new CdpClient(socket));
      }, { once: true });

      socket.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('Failed to connect to CDP socket'));
      }, { once: true });
    });
  }

  async evaluate<T = JsonValue>(expression: string, timeoutMs = 10_000): Promise<T> {
    const response = await this.send<{
      exceptionDetails?: { text?: string; exception?: { description?: string } };
      result?: { description?: string; subtype?: string; value?: T };
    }>('Runtime.evaluate', {
      awaitPromise: true,
      expression,
      returnByValue: true,
      userGesture: true,
    }, timeoutMs);

    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Runtime.evaluate failed');
    }
    if (response.result?.subtype === 'error') {
      throw new Error(response.result.description || 'Runtime.evaluate returned an error');
    }
    return response.result?.value as T;
  }

  send<T = JsonValue>(method: string, params: Record<string, JsonValue> = {}, timeoutMs = 10_000): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);

      this.pending.set(id, {
        reject,
        resolve: (value) => resolve(value as T),
        timeout,
      });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket.close();
  }

  private async handleMessage(event: MessageEvent) {
    const text = await messageEventToText(event.data as unknown);
    const message = JSON.parse(text) as {
      id?: number;
      error?: { message?: string };
      result?: JsonValue;
    };

    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);

    if (message.error) {
      pending.reject(new Error(message.error.message || 'CDP command failed'));
      return;
    }

    pending.resolve(message.result ?? null);
  }
}

async function messageEventToText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  if (data instanceof Blob) return await data.text();
  return String(data);
}

async function captureOutput(stream: ReadableStream<Uint8Array> | null, fileName: string) {
  if (!stream) return;
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } catch {
    // The stream can close during app shutdown.
  } finally {
    writeFileSync(join(EVIDENCE_DIR, fileName), Buffer.concat(chunks));
  }
}

function copyMainLogEvidence() {
  const candidatePaths = [
    join(homedir(), 'Library/Logs/@rox-one/electron/main.log'),
    join(homedir(), 'Library/Logs/ROX.ONE/main.log'),
  ];

  for (const logPath of candidatePaths) {
    if (!existsSync(logPath)) continue;
    try {
      const evidenceName = `main-${logPath.split('/').at(-2) ?? 'electron'}.log`;
      const logText = readRecentTextFile(logPath, 512 * 1024);
      const smokeLines = logText
        .split(/\r?\n/)
        .filter((line) => line.includes('rox-one-ui-smoke') || lineTimestampIsAfterSmokeStart(line));
      writeFileSync(
        join(EVIDENCE_DIR, evidenceName),
        smokeLines.length > 0 ? `${smokeLines.join('\n')}\n` : logText,
      );
    } catch {
      // Best-effort evidence copy only.
    }
  }
}

function readRecentTextFile(filePath: string, maxBytes: number): string {
  const size = statSync(filePath).size;
  const start = Math.max(0, size - maxBytes);
  const file = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(size - start);
    readSync(file, buffer, 0, buffer.length, start);
    return buffer.toString('utf8');
  } finally {
    closeSync(file);
  }
}

function lineTimestampIsAfterSmokeStart(line: string): boolean {
  const match = /"timestamp":"([^"\\]+)"/.exec(line) ?? /^(\d{4}-\d{2}-\d{2}T[^ ]+)/.exec(line);
  if (!match?.[1]) return false;
  const timestampMs = Date.parse(match[1]);
  return Number.isFinite(timestampMs) && timestampMs >= smokeStartedAtMs - 2_000;
}

function escapeForJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function fail(message: string): never {
  console.error(`[ui-smoke] ${message}`);
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
