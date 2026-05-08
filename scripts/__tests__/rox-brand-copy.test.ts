import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

const activeBackendCopyFiles = [
  'apps/electron/src/renderer/pages/settings/AiSettingsPage.tsx',
  'apps/electron/src/renderer/lib/provider-icons.ts',
  'apps/electron/src/renderer/components/apisetup/ApiKeyInput.tsx',
  'apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx',
  'packages/shared/src/config/models-pi.ts',
  'packages/shared/src/agent/pi-agent.ts',
  'packages/shared/src/agent/diagnostics.ts',
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

describe('ROX.ONE active copy', () => {
  it('uses dotted backend naming in active runtime and renderer labels', () => {
    const offenders = activeBackendCopyFiles.filter((relativePath) =>
      readRepoFile(relativePath).includes('ROX ONE Backend')
    );

    expect(offenders).toEqual([]);
  });

  it('keeps the renderer document title dotted', () => {
    expect(readRepoFile('apps/electron/src/renderer/index.html')).toContain('<title>ROX.ONE</title>');
  });

  it('keeps active backend surfaces visibly tied to ROX.ONE Backend', () => {
    for (const relativePath of activeBackendCopyFiles) {
      expect(readRepoFile(relativePath)).toContain('ROX.ONE Backend');
    }
  });
});
