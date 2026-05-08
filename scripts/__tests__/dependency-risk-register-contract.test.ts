import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');
const registerPath = join(rootDir, 'docs/release/dependency-risk-register-2026-05-08.md');
const matrixPath = join(rootDir, 'docs/release/production-readiness-matrix-2026-05-06.md');

function read(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function gitStatusFor(paths: string[]): string {
  const result = spawnSync('git', ['status', '--short', '--', ...paths], {
    cwd: rootDir,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'git status failed');
  }
  return result.stdout.trim();
}

describe('dependency risk register release contract', () => {
  it('requires an audit-backed risk register linked from release readiness docs', () => {
    expect(existsSync(registerPath)).toBe(true);

    const register = read('docs/release/dependency-risk-register-2026-05-08.md');
    const matrix = read('docs/release/production-readiness-matrix-2026-05-06.md');

    expect(register).toContain('# Dependency Risk Register - 2026-05-08');
    expect(register).toContain('## Live Audit Result');
    expect(register).toContain('## Severity Snapshot');
    expect(register).toContain('## Production Exposure Classification');
    expect(register).toContain('## Remediation Lanes');
    expect(register).toContain('## Verification Commands');
    expect(register).toContain('Public production remains blocked');
    expect(register).toContain('bun audit');

    expect(matrix).toContain('dependency-risk-register-2026-05-08.md');
    expect(matrix).toContain('Public production: no.');
    expect(matrix).toContain('dependency audit');

    expect(gitStatusFor(['package.json', 'bun.lock', 'apps/electron/package.json'])).toBe('');
  });
});
