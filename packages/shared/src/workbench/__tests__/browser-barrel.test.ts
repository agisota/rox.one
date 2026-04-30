import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'bun:test';

const WORKBENCH_DIR = join(import.meta.dir, '..');

describe('workbench browser barrel', () => {
  it('does not export the Node-only default workspace bundle to renderer builds', () => {
    const barrel = readFileSync(join(WORKBENCH_DIR, 'index.ts'), 'utf8');

    expect(barrel).not.toContain('default-workspace-bundle');
  });
});
