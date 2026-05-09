import { existsSync, mkdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import {
  ensureSessionDir,
  getSessionFilePath,
  sanitizeSessionId,
  writeSessionJsonl,
  type StoredMessage,
  type StoredSession,
} from '@craft-agent/shared/sessions';

interface ExternalAgentSessionIndexEntry {
  id?: unknown;
  thread_name?: unknown;
  updated_at?: unknown;
}

interface ExternalAgentImportRecord {
  imported_thread_id?: unknown;
  imported_at?: unknown;
  content_sha256?: unknown;
}

export interface ExternalAgentSessionImportResult {
  importedSessionIds: string[];
  skippedExistingSessionIds: string[];
  invalidLineCount: number;
  indexPath: string;
}

export interface ExternalAgentSessionImportOptions {
  workspaceRootPath: string;
  configDir?: string;
  now?: number;
}

const DEFAULT_SESSION_TITLE = 'Imported external agent session';
const IMPORT_LABELS = ['source::external-agent', 'import::rox-index'];

function defaultConfigDir(): string {
  return join(homedir(), '.rox');
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\[skill:(?:[\w-]+:)?[\w-]+\]/g, '')
    .replace(/\[source:[\w-]+\]/g, '')
    .replace(/\[file:[^\]]+\]/g, '')
    .replace(/\[folder:[^\]]+\]/g, '');
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(?:authorization|api[_-]?key|token|secret|password)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, (match) => {
      const separator = match.includes(':') ? ':' : '=';
      const key = match.slice(0, match.indexOf(separator)).trim();
      return `${key}${separator}<redacted>`;
    })
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer <redacted>')
    .replace(/\bsk-[A-Za-z0-9._-]{6,}\b/g, '<redacted>')
    .replace(/\/Users\/[^\s"'`]+/g, '<redacted-path>')
    .replace(/~\/[^\s"'`]+/g, '<redacted-path>');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeTitle(raw: unknown): string {
  const source = typeof raw === 'string' ? raw : '';
  const sanitized = normalizeWhitespace(redactSensitiveText(stripMarkup(source)));
  return (sanitized || DEFAULT_SESSION_TITLE).slice(0, 160);
}

function parseTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/\.(\d{3})\d+Z$/, '.$1Z');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIndexLine(line: string): ExternalAgentSessionIndexEntry | null {
  try {
    const parsed = JSON.parse(line) as ExternalAgentSessionIndexEntry;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function readImportRecords(configDir: string): Map<string, ExternalAgentImportRecord> {
  const recordsPath = join(configDir, 'external_agent_session_imports.json');
  if (!existsSync(recordsPath)) return new Map();

  try {
    const parsed = JSON.parse(readFileSync(recordsPath, 'utf8')) as ExternalAgentImportRecord[];
    if (!Array.isArray(parsed)) return new Map();

    const records = new Map<string, ExternalAgentImportRecord>();
    for (const record of parsed) {
      if (typeof record.imported_thread_id === 'string' && record.imported_thread_id) {
        records.set(record.imported_thread_id, record);
      }
    }
    return records;
  } catch {
    return new Map();
  }
}

function buildImportSummary(id: string, title: string, record: ExternalAgentImportRecord | undefined): string {
  const lines = [
    'Imported external agent session',
    '',
    `Title: ${title}`,
    `Thread ID: ${id}`,
    'Source: sanitized ROX external agent session index',
  ];

  if (typeof record?.content_sha256 === 'string' && record.content_sha256) {
    lines.push(`Source hash: ${record.content_sha256.slice(0, 12)}`);
  }

  if (typeof record?.imported_at === 'string' && record.imported_at) {
    lines.push(`Indexed at: ${redactSensitiveText(record.imported_at)}`);
  }

  lines.push('', 'Raw external transcript paths and prompt bodies are intentionally not embedded in this workspace session.');
  return lines.join('\n');
}

function buildImportedSession(
  workspaceRootPath: string,
  id: string,
  title: string,
  timestamp: number,
  now: number,
  record: ExternalAgentImportRecord | undefined,
): StoredSession {
  const sessionDir = ensureSessionDir(workspaceRootPath, id);
  const messages: StoredMessage[] = [
    {
      id: `${id}-import-user`,
      type: 'user',
      content: buildImportSummary(id, title, record),
      timestamp,
    },
    {
      id: `${id}-import-assistant`,
      type: 'assistant',
      content: [
        'This is a sanitized session-index stub imported into ROX.ONE.',
        'Use it to find and organize the external agent run in the app without exposing raw private transcripts.',
      ].join('\n'),
      timestamp: timestamp + 1,
    },
  ];

  return {
    id,
    workspaceRootPath,
    sdkCwd: sessionDir,
    name: title,
    createdAt: timestamp,
    lastUsedAt: now,
    lastMessageAt: timestamp,
    isFlagged: false,
    sessionStatus: 'inbox',
    labels: IMPORT_LABELS,
    enabledSourceSlugs: [],
    permissionMode: 'safe',
    messages,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      costUsd: 0,
    },
  };
}

export function importExternalAgentSessionIndex(
  options: ExternalAgentSessionImportOptions,
): ExternalAgentSessionImportResult {
  const configDir = options.configDir ?? defaultConfigDir();
  const now = options.now ?? Date.now();
  const indexPath = join(configDir, 'session_index.jsonl');
  const result: ExternalAgentSessionImportResult = {
    importedSessionIds: [],
    skippedExistingSessionIds: [],
    invalidLineCount: 0,
    indexPath,
  };

  if (!existsSync(indexPath)) {
    return result;
  }

  mkdirSync(options.workspaceRootPath, { recursive: true });
  const importRecords = readImportRecords(configDir);
  const lines = readFileSync(indexPath, 'utf8').split('\n').filter(Boolean);

  for (const line of lines) {
    const entry = parseIndexLine(line);
    if (!entry || typeof entry.id !== 'string' || !entry.id) {
      result.invalidLineCount++;
      continue;
    }

    const sessionId = sanitizeSessionId(entry.id);
    if (!sessionId || sessionId !== entry.id) {
      result.invalidLineCount++;
      continue;
    }

    const sessionFile = getSessionFilePath(options.workspaceRootPath, sessionId);
    if (existsSync(sessionFile)) {
      result.skippedExistingSessionIds.push(sessionId);
      continue;
    }

    const title = sanitizeTitle(entry.thread_name);
    const timestamp = parseTimestamp(entry.updated_at, now);
    const session = buildImportedSession(
      options.workspaceRootPath,
      sessionId,
      title,
      timestamp,
      now,
      importRecords.get(sessionId),
    );

    writeSessionJsonl(sessionFile, session);
    result.importedSessionIds.push(sessionId);
  }

  return result;
}
