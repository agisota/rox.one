import { describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRendererChunks } from './validate-renderer-chunks';

function withChunkFixture(files: Record<string, string>, run: (assetsDir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'rox-renderer-chunks-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content);
    }
    run(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

describe('validateRendererChunks', () => {
  it('rejects the broken React/i18n circular import shape that leaves packaged builds on the loader', () => {
    withChunkFixture(
      {
        'index-react-a1b2.js': 'import{I as init}from"./i18n-c3d4.js";export const r={createContext(){return {}}};init();',
        'i18n-c3d4.js': 'import{r as React}from"./index-react-a1b2.js";export const I=()=>React.createContext(null);',
        'main-aaaa.js': 'import"./index-react-a1b2.js";',
      },
      (assetsDir) => {
        expect(validateRendererChunks(assetsDir).issues.map((issue) => issue.message)).toContain(
          'React runtime chunk and i18n chunk import each other; this is the packaged-loader crash shape.',
        );
      },
    );
  });

  it('allows i18n to depend on React when React does not import i18n back', () => {
    withChunkFixture(
      {
        'index-react-a1b2.js': 'export const r={createContext(){return {}}};',
        'i18n-c3d4.js': 'import{r as React}from"./index-react-a1b2.js";export const I=()=>React.createContext(null);',
        'main-aaaa.js': 'import"./i18n-c3d4.js";',
      },
      (assetsDir) => {
        expect(validateRendererChunks(assetsDir).issues).toEqual([]);
      },
    );
  });
});
