import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

describe('release current handoff contract', () => {
  it('keeps release docs aligned with current productionization git truth', () => {
    const finalRc = read('docs/release/final-rc-2026-05-06.md');
    const snapshot = read('docs/release/current-state-snapshot-2026-05-06.md');
    const matrix = read('docs/release/production-readiness-matrix-2026-05-06.md');

    const expectedTickets = [
      ['T098', '706b638'],
      ['T099', '7ff5cd9'],
      ['T100', 'c5cd060'],
      ['T101', 'da5ed8d'],
      ['T102', '4213878'],
      ['T103', '154b722'],
      ['T104', '4485641'],
    ] as const;

    for (const [ticket, commit] of expectedTickets) {
      expect(finalRc).toContain(`| ${ticket} |`);
      expect(finalRc).toContain(`| \`${commit}\` |`);
    }

    expect(finalRc).toContain('dependency-risk-register-2026-05-08.md');
    expect(finalRc).toContain('Public production launch status: blocked');

    expect(snapshot).toContain('T098-T122 continuation');
    expect(snapshot).toContain('runtime artifact git hygiene');
    expect(snapshot).toContain('T104 Dependency Audit Risk Register');
    expect(snapshot).toContain('Public production remains blocked');

    expect(finalRc).toContain('T090 through T122 are committed');
    expect(finalRc).toContain('T098-T122');
    expect(matrix).toContain('T104 dependency risk-register');
    expect(matrix).toContain('dependency-risk-register-2026-05-08.md');
    expect(matrix).toContain('Public production: no.');
  });
});
