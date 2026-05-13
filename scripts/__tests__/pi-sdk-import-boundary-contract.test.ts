import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const rootDir = join(import.meta.dir, '..', '..');

function read(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function readPackageJson(): { exports?: Record<string, string> } {
  return JSON.parse(read('packages/shared/package.json')) as { exports?: Record<string, string> };
}

describe('PI SDK import boundary contract', () => {
  it('keeps PI SDK model discovery out of the broad shared config barrel', () => {
    const configBarrel = read('packages/shared/src/config/index.ts');
    const sharedPackage = readPackageJson();

    expect(configBarrel).not.toContain("export * from './models-pi.ts'");
    expect(sharedPackage.exports?.['./config/models-pi']).toBe('./src/config/models-pi.ts');
  });

  it('routes PI-only consumers through the explicit models-pi subpath', () => {
    const electronMain = read('apps/electron/src/main/index.ts');
    const llmConnections = read('packages/server-core/src/handlers/rpc/llm-connections.ts');

    expect(electronMain).toContain(
      "from '@rox-one/shared/config/models-pi'",
    );
    expect(electronMain).not.toContain(
      "getPiModelsForAuthProvider, getAllPiModels } from '@rox-one/shared/config'",
    );

    expect(llmConnections).toContain(
      "await import('@rox-one/shared/config/models-pi')",
    );
    expect(llmConnections).not.toContain(
      "{ getPiApiKeyProviders } = await import('@rox-one/shared/config')",
    );
    expect(llmConnections).not.toContain(
      "{ getPiProviderBaseUrl } = await import('@rox-one/shared/config')",
    );
  });

  it('keeps server-core PI SDK discovery imports behind public exposure guards', () => {
    const llmConnections = read('packages/server-core/src/handlers/rpc/llm-connections.ts');
    const importStatement = "await import('@rox-one/shared/config/models-pi')";

    const providersHandler = llmConnections.indexOf('server.handle(RPC_CHANNELS.pi.GET_API_KEY_PROVIDERS');
    const providersGuard = llmConnections.indexOf("surface: 'PI API key provider discovery'", providersHandler);
    const providersImport = llmConnections.indexOf(importStatement, providersHandler);

    expect(providersHandler).toBeGreaterThanOrEqual(0);
    expect(providersGuard).toBeGreaterThan(providersHandler);
    expect(providersImport).toBeGreaterThan(providersHandler);
    expect(providersGuard).toBeLessThan(providersImport);

    const baseUrlHandler = llmConnections.indexOf('server.handle(RPC_CHANNELS.pi.GET_PROVIDER_BASE_URL');
    const baseUrlGuard = llmConnections.indexOf("surface: 'PI provider base URL discovery'", baseUrlHandler);
    const baseUrlImport = llmConnections.indexOf(importStatement, baseUrlHandler);

    expect(baseUrlHandler).toBeGreaterThanOrEqual(0);
    expect(baseUrlGuard).toBeGreaterThan(baseUrlHandler);
    expect(baseUrlImport).toBeGreaterThan(baseUrlHandler);
    expect(baseUrlGuard).toBeLessThan(baseUrlImport);
  });

  it('keeps the internal PI driver model registry behind lazy imports', () => {
    const piDriver = read('packages/shared/src/agent/backend/internal/drivers/pi.ts');

    expect(piDriver).not.toContain("from '../../../../config/models-pi.ts'");
    expect(piDriver).toContain("await import('../../../../config/models-pi.ts')");
  });
});
