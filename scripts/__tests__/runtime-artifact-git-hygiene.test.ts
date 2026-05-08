import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

function git(args: string[]) {
  return spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

describe('runtime artifact git hygiene', () => {
  it('keeps local runtime artifacts ignored and out of the repository index', () => {
    const gitignore = readFileSync(join(rootDir, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const runtimeArtifacts = ['events.jsonl', '.claude/', '.ouroboros/'];

    for (const artifact of runtimeArtifacts) {
      expect(gitignore).toContain(artifact);
    }

    for (const artifact of runtimeArtifacts) {
      const result = git(['ls-files', '--error-unmatch', artifact]);
      expect(result.status).not.toBe(0);
    }
  });
});
