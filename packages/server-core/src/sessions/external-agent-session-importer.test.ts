import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getSessionFilePath, loadSession } from '@rox-agent/shared/sessions';
import { importExternalAgentSessionIndex } from './external-agent-session-importer.ts';

let tempDir: string;
let configDir: string;
let workspaceRootPath: string;

const FIXED_NOW = Date.UTC(2026, 4, 9, 0, 0, 0);

function writeIndexLines(lines: unknown[]): void {
  writeFileSync(
    join(configDir, 'session_index.jsonl'),
    lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n') + '\n',
  );
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'external-agent-session-importer-test-'));
  configDir = join(tempDir, '.rox');
  workspaceRootPath = join(tempDir, 'workspace');
  mkdirSync(configDir, { recursive: true });
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('external agent session importer', () => {
  it('creates visible workspace sessions from the sanitized session index', () => {
    writeIndexLines([
      {
        id: '019ddd51-cbf6-7cc3-ab08-dfd5f8c16b12',
        thread_name: '<command-name>/model</command-name>',
        updated_at: '2026-04-30T07:37:01.238099Z',
      },
      {
        id: '019ddd51-d7a5-7d31-b128-cc6756b3142c',
        thread_name: 'go to ssh eu-stockholm and check api.zed.md',
        updated_at: '2026-04-30T07:37:04.172865Z',
      },
      '{bad json',
      {
        id: '',
        thread_name: 'missing id',
        updated_at: '2026-04-30T07:37:04.172865Z',
      },
    ]);
    writeFileSync(
      join(configDir, 'external_agent_session_imports.json'),
      JSON.stringify([
        {
          source_path: '/Users/marklindgreen/.claude/projects/private/raw.jsonl',
          content_sha256: 'abc123',
          imported_thread_id: '019ddd51-cbf6-7cc3-ab08-dfd5f8c16b12',
          imported_at: '2026-05-09T00:00:00.000Z',
        },
      ]),
    );

    const result = importExternalAgentSessionIndex({
      workspaceRootPath,
      configDir,
      now: FIXED_NOW,
    });

    expect(result.importedSessionIds).toEqual([
      '019ddd51-cbf6-7cc3-ab08-dfd5f8c16b12',
      '019ddd51-d7a5-7d31-b128-cc6756b3142c',
    ]);
    expect(result.invalidLineCount).toBe(2);

    const first = loadSession(workspaceRootPath, '019ddd51-cbf6-7cc3-ab08-dfd5f8c16b12');
    expect(first?.name).toBe('/model');
    expect(first?.sessionStatus).toBe('inbox');
    expect(first?.labels).toContain('source::external-agent');
    expect(first?.permissionMode).toBe('safe');
    expect(first?.messages).toHaveLength(2);
    expect(first?.messages[0]?.content).toContain('Imported external agent session');
    expect(first?.messages[0]?.content).not.toContain('/Users/marklindgreen');
    expect(first?.messages[0]?.content).not.toContain('raw.jsonl');
    expect(first?.messages[1]?.type).toBe('assistant');

    const sessionFile = getSessionFilePath(workspaceRootPath, '019ddd51-cbf6-7cc3-ab08-dfd5f8c16b12');
    expect(existsSync(sessionFile)).toBe(true);
  });

  it('is idempotent and keeps user-edited imported sessions intact', () => {
    writeIndexLines([
      {
        id: '019ddd51-e2ad-78f1-8bbc-35e6e830b3c3',
        thread_name: 'fix terminal font',
        updated_at: '2026-04-30T07:37:07.231135Z',
      },
    ]);

    const first = importExternalAgentSessionIndex({
      workspaceRootPath,
      configDir,
      now: FIXED_NOW,
    });
    expect(first.importedSessionIds).toEqual(['019ddd51-e2ad-78f1-8bbc-35e6e830b3c3']);

    const sessionFile = getSessionFilePath(workspaceRootPath, '019ddd51-e2ad-78f1-8bbc-35e6e830b3c3');
    const edited = readFileSync(sessionFile, 'utf8').replace('fix terminal font', 'user edited title');
    writeFileSync(sessionFile, edited);

    const second = importExternalAgentSessionIndex({
      workspaceRootPath,
      configDir,
      now: FIXED_NOW + 1,
    });

    expect(second.importedSessionIds).toEqual([]);
    expect(second.skippedExistingSessionIds).toEqual(['019ddd51-e2ad-78f1-8bbc-35e6e830b3c3']);
    expect(readFileSync(sessionFile, 'utf8')).toContain('user edited title');
  });

  it('redacts secret-like content from titles and generated messages', () => {
    writeIndexLines([
      {
        id: '019ddd51-fcd1-7752-88d6-b8546eaf1e0b',
        thread_name: 'I need AUTHORIZATION=Bearer abc123 and OPENAI_API_KEY=sk-live-secret for test',
        updated_at: 'not-a-date',
      },
    ]);

    const result = importExternalAgentSessionIndex({
      workspaceRootPath,
      configDir,
      now: FIXED_NOW,
    });

    expect(result.importedSessionIds).toEqual(['019ddd51-fcd1-7752-88d6-b8546eaf1e0b']);

    const imported = loadSession(workspaceRootPath, '019ddd51-fcd1-7752-88d6-b8546eaf1e0b');
    const serialized = JSON.stringify(imported);
    expect(imported?.createdAt).toBe(FIXED_NOW);
    expect(serialized).not.toContain('abc123');
    expect(serialized).not.toContain('sk-live-secret');
    expect(serialized).toContain('<redacted>');
  });
});
