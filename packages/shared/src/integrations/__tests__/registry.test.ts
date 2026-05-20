/**
 * IntegrationRegistry tests (PZD-78).
 *
 * What & why:
 *
 * 1. Register / get / list — every future integration is registered at
 *    startup. The registry is the single lookup point downstream code uses
 *    (`getIntegrationById` for routing, `listIntegrations` for menus), so the
 *    happy paths must be airtight.
 *
 * 2. Duplicate-id detection — two integrations sharing an `id` would silently
 *    overwrite each other and produce unpredictable routing. The registry
 *    fails fast at `register()` time with an error naming the duplicate id.
 *
 * 3. Startup validation — the registry runs the Zod schema against each
 *    registered manifest. An invalid manifest (security-baseline weakening,
 *    missing field) must abort startup with an error message that includes
 *    BOTH the manifest id AND the underlying Zod error so operators can
 *    diagnose without grepping.
 */

import { describe, expect, it } from 'bun:test';
import { IntegrationRegistry } from '../registry.ts';
import type {
  InProcessIntegrationManifest,
  WebContentsViewIntegrationManifest,
} from '../manifest.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const inProcessFixture: InProcessIntegrationManifest = {
  id: 'in-process-fixture',
  kind: 'in-process',
  displayName: 'In-Process Fixture',
  trustedOrigins: [],
  ipcChannels: ['fixture:ping'],
  lifecycle: {
    onActivate: 'fixture.onActivate',
    onDeactivate: 'fixture.onDeactivate',
  },
  telemetry: { enabled: false },
  capabilities: { requiresNetwork: false, requiresCamera: false },
  budget: { rendererGzipBytes: 0, mainStartupMs: 50 },
};

const wcvFixture: WebContentsViewIntegrationManifest = {
  id: 'wcv-fixture',
  kind: 'web-contents-view',
  displayName: 'WCV Fixture',
  preloadPath: 'preload/fixture.cjs',
  trustedOrigins: ['https://example.com'],
  ipcChannels: ['fixture:event'],
  lifecycle: {
    onActivate: 'fixture.onActivate',
    onDeactivate: 'fixture.onDeactivate',
  },
  telemetry: { enabled: false },
  capabilities: { requiresNetwork: true, requiresCamera: false },
  budget: { rendererGzipBytes: 100_000, mainStartupMs: 100 },
};

// ---------------------------------------------------------------------------
// 1. Register / get / list
// ---------------------------------------------------------------------------

describe('IntegrationRegistry — happy paths', () => {
  it('registers and retrieves an in-process manifest by id', () => {
    const reg = new IntegrationRegistry();
    reg.register(inProcessFixture);
    expect(reg.get(inProcessFixture.id)).toEqual(inProcessFixture);
  });

  it('registers a web-contents-view manifest', () => {
    const reg = new IntegrationRegistry();
    reg.register(wcvFixture);
    expect(reg.get(wcvFixture.id)?.kind).toBe('web-contents-view');
  });

  it('returns undefined for an unknown id', () => {
    const reg = new IntegrationRegistry();
    expect(reg.get('does-not-exist')).toBeUndefined();
  });

  it('list() returns all registered manifests', () => {
    const reg = new IntegrationRegistry();
    reg.register(inProcessFixture);
    reg.register(wcvFixture);
    const all = reg.list();
    expect(all).toHaveLength(2);
    expect(all.map((m) => m.id).sort()).toEqual(
      [inProcessFixture.id, wcvFixture.id].sort(),
    );
  });

  it('list() returns an empty array for an empty registry', () => {
    expect(new IntegrationRegistry().list()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. Duplicate-id detection
// ---------------------------------------------------------------------------

describe('IntegrationRegistry — duplicate ids', () => {
  it('throws when registering two manifests with the same id', () => {
    const reg = new IntegrationRegistry();
    reg.register(inProcessFixture);
    expect(() => reg.register(inProcessFixture)).toThrow(/duplicate/i);
  });

  it('includes the duplicate id in the error message', () => {
    const reg = new IntegrationRegistry();
    reg.register(inProcessFixture);
    try {
      reg.register({ ...inProcessFixture, displayName: 'Other' });
      throw new Error('expected throw');
    } catch (err) {
      expect((err as Error).message).toContain(inProcessFixture.id);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Startup validation
// ---------------------------------------------------------------------------

describe('IntegrationRegistry — startup validation', () => {
  it('register() runs the Zod schema and rejects an invalid manifest', () => {
    const reg = new IntegrationRegistry();
    const broken = {
      ...inProcessFixture,
      id: '', // empty id
    } as InProcessIntegrationManifest;
    expect(() => reg.register(broken)).toThrow();
  });

  it('register() rejects a security-baseline weakening attempt', () => {
    const reg = new IntegrationRegistry();
    const unsafe = {
      ...wcvFixture,
      sandbox: false,
    } as unknown as WebContentsViewIntegrationManifest;
    expect(() => reg.register(unsafe)).toThrow();
  });

  it('validateAll() returns ok for all-valid registries', () => {
    const reg = new IntegrationRegistry();
    reg.register(inProcessFixture);
    reg.register(wcvFixture);
    const result = reg.validateAll();
    expect(result.ok).toBe(true);
  });

  it('error message names the failing manifest id and underlying issue', () => {
    const reg = new IntegrationRegistry();
    const broken = {
      ...inProcessFixture,
      id: 'broken-manifest',
      budget: { rendererGzipBytes: -1, mainStartupMs: 0 },
    } as unknown as InProcessIntegrationManifest;
    try {
      reg.register(broken);
      throw new Error('expected throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('broken-manifest');
      expect(msg.toLowerCase()).toContain('budget');
    }
  });
});
