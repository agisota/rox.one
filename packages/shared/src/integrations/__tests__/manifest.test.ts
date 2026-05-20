/**
 * Integration Manifest schema tests (PZD-78).
 *
 * What & why:
 *
 * 1. Happy paths — a minimal `in-process` manifest and a `web-contents-view`
 *    manifest must round-trip cleanly through the Zod parser without losing
 *    fields. Future integrations (Rox Design, T271 artifacts, Browser-as-tool)
 *    all consume this primitive, so a regression here is catastrophic.
 *
 * 2. Required-field rejection — missing `id`, `kind`, `displayName`,
 *    `trustedOrigins`, `ipcChannels`, `lifecycle`, `telemetry`, `capabilities`,
 *    or `budget` must fail with an error message that names the offending
 *    field. The registry's fail-fast startup path depends on this.
 *
 * 3. Type rejection — wrong types (e.g. `id: 42`, `kind: 'browser'`,
 *    `trustedOrigins: 'https://x'` as a string instead of array) must be
 *    rejected. We tighten the boundary so the rest of the codebase can trust
 *    `IntegrationManifest` shape unconditionally.
 *
 * 4. Security baseline non-overridability (RUNTIME) — any manifest that tries
 *    to declare `sandbox: false`, `contextIsolation: false`,
 *    `nodeIntegration: true`, or `webviewTag: true` on a `web-contents-view`
 *    integration must fail at the Zod boundary. The schema declares these as
 *    literal-true / literal-false (or omits them entirely).
 *
 * 5. Security baseline non-overridability (COMPILE-TIME) — the TS type
 *    `WebContentsViewSecurityBaseline` only accepts the safe literals, so a
 *    misconfigured manifest in a future PR fails `tsc --noEmit`. This test
 *    file exercises the type via `satisfies` and `@ts-expect-error`.
 *
 * 6. Discriminated-union edges — an `in-process` manifest carrying a
 *    `preloadPath` is rejected (preloadPath is meaningless without a
 *    WebContentsView); a `web-contents-view` manifest *without* `preloadPath`
 *    is rejected (security baseline requires a preload).
 */

import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import {
  IntegrationManifestSchema,
  parseIntegrationManifest,
  type IntegrationManifest,
  type InProcessIntegrationManifest,
  type WebContentsViewIntegrationManifest,
} from '../manifest.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validInProcess: InProcessIntegrationManifest = {
  id: 'in-process-fixture',
  kind: 'in-process',
  displayName: 'In-Process Fixture',
  trustedOrigins: [],
  ipcChannels: ['fixture:ping'],
  lifecycle: {
    onActivate: 'fixture.onActivate',
    onDeactivate: 'fixture.onDeactivate',
  },
  telemetry: {
    enabled: false,
  },
  capabilities: {
    requiresNetwork: false,
    requiresCamera: false,
  },
  budget: {
    rendererGzipBytes: 0,
    mainStartupMs: 50,
  },
};

const validWebContentsView: WebContentsViewIntegrationManifest = {
  id: 'wcv-fixture',
  kind: 'web-contents-view',
  displayName: 'WebContentsView Fixture',
  preloadPath: 'preload/fixture.cjs',
  trustedOrigins: ['https://example.com'],
  ipcChannels: ['fixture:event'],
  lifecycle: {
    onActivate: 'fixture.onActivate',
    onDeactivate: 'fixture.onDeactivate',
  },
  skin: {
    backgroundColor: '#000000',
  },
  navigation: {
    initialUrl: 'https://example.com/start',
    allowedHostPatterns: ['example.com'],
  },
  telemetry: {
    enabled: true,
    eventPrefix: 'fixture',
  },
  capabilities: {
    requiresNetwork: true,
    requiresCamera: false,
  },
  budget: {
    rendererGzipBytes: 200_000,
    mainStartupMs: 200,
  },
};

// ---------------------------------------------------------------------------
// 1. Happy paths
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — happy path', () => {
  it('accepts a minimal in-process manifest', () => {
    const result = IntegrationManifestSchema.safeParse(validInProcess);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('in-process');
      expect(result.data.id).toBe('in-process-fixture');
    }
  });

  it('accepts a full web-contents-view manifest', () => {
    const result = IntegrationManifestSchema.safeParse(validWebContentsView);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('web-contents-view');
      if (result.data.kind === 'web-contents-view') {
        expect(result.data.preloadPath).toBe('preload/fixture.cjs');
        expect(result.data.trustedOrigins).toEqual(['https://example.com']);
      }
    }
  });

  it('parseIntegrationManifest returns the manifest on success', () => {
    const parsed = parseIntegrationManifest(validInProcess);
    expect(parsed.id).toBe(validInProcess.id);
  });
});

// ---------------------------------------------------------------------------
// 2. Required-field rejection
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — required fields', () => {
  const requiredFields: ReadonlyArray<keyof InProcessIntegrationManifest> = [
    'id',
    'kind',
    'displayName',
    'trustedOrigins',
    'ipcChannels',
    'lifecycle',
    'telemetry',
    'capabilities',
    'budget',
  ];

  for (const field of requiredFields) {
    it(`rejects an in-process manifest missing "${field}"`, () => {
      const broken = { ...validInProcess };
      delete (broken as Record<string, unknown>)[field];
      const result = IntegrationManifestSchema.safeParse(broken);
      expect(result.success).toBe(false);
      if (!result.success) {
        const flat = result.error.issues.map((i) => i.path.join('.')).join(',');
        expect(flat).toContain(field);
      }
    });
  }

  it('rejects an empty id', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      id: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty displayName', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      displayName: '',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Type rejection
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — type validation', () => {
  it('rejects a numeric id', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      id: 42,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown kind', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      kind: 'browser',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a string in place of trustedOrigins array', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      trustedOrigins: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric rendererGzipBytes budget', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      budget: { rendererGzipBytes: 'lots', mainStartupMs: 50 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative mainStartupMs budget', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      budget: { rendererGzipBytes: 0, mainStartupMs: -1 },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Security baseline — runtime rejection
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — security baseline runtime', () => {
  it('rejects sandbox: false on a web-contents-view manifest', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validWebContentsView,
      sandbox: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects contextIsolation: false on a web-contents-view manifest', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validWebContentsView,
      contextIsolation: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects nodeIntegration: true on a web-contents-view manifest', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validWebContentsView,
      nodeIntegration: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects webviewTag: true on a web-contents-view manifest', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validWebContentsView,
      webviewTag: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts the safe literals when explicitly stated', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validWebContentsView,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Security baseline — compile-time rejection
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — security baseline compile-time', () => {
  it('the safe literal manifest type-checks', () => {
    const safe: WebContentsViewIntegrationManifest = {
      ...validWebContentsView,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    };
    expect(safe.kind).toBe('web-contents-view');
  });

  it('rejects sandbox: false at compile time', () => {
    const unsafe: WebContentsViewIntegrationManifest = {
      ...validWebContentsView,
      // @ts-expect-error sandbox: false must not be assignable
      sandbox: false,
    };
    // Reference unsafe to keep the test runtime-meaningful and avoid noUnusedLocals
    expect(unsafe.kind).toBe('web-contents-view');
  });

  it('rejects contextIsolation: false at compile time', () => {
    const unsafe: WebContentsViewIntegrationManifest = {
      ...validWebContentsView,
      // @ts-expect-error contextIsolation: false must not be assignable
      contextIsolation: false,
    };
    expect(unsafe.kind).toBe('web-contents-view');
  });

  it('rejects nodeIntegration: true at compile time', () => {
    const unsafe: WebContentsViewIntegrationManifest = {
      ...validWebContentsView,
      // @ts-expect-error nodeIntegration: true must not be assignable
      nodeIntegration: true,
    };
    expect(unsafe.kind).toBe('web-contents-view');
  });

  it('rejects webviewTag: true at compile time', () => {
    const unsafe: WebContentsViewIntegrationManifest = {
      ...validWebContentsView,
      // @ts-expect-error webviewTag: true must not be assignable
      webviewTag: true,
    };
    expect(unsafe.kind).toBe('web-contents-view');
  });
});

// ---------------------------------------------------------------------------
// 6. Discriminated-union edges
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — discriminated union', () => {
  it('rejects an in-process manifest carrying preloadPath', () => {
    const result = IntegrationManifestSchema.safeParse({
      ...validInProcess,
      preloadPath: 'preload/should-not-be-here.cjs',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a web-contents-view manifest missing preloadPath', () => {
    const broken = { ...validWebContentsView };
    delete (broken as { preloadPath?: string }).preloadPath;
    const result = IntegrationManifestSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it('exposes the inferred manifest type as a discriminated union', () => {
    // Type-level cross-check: narrowing on kind must remove fields from the
    // wrong branch. If this compiles, the discriminator works.
    const inspect = (m: IntegrationManifest): string => {
      if (m.kind === 'in-process') {
        // @ts-expect-error preloadPath does not exist on in-process branch
        const _p: string | undefined = m.preloadPath;
        void _p;
        return m.id;
      }
      // Inside this branch m is narrowed to WebContentsViewIntegrationManifest
      // — preloadPath is required and typed string.
      const preload: string = m.preloadPath;
      return preload;
    };

    expect(inspect(validInProcess)).toBe(validInProcess.id);
    expect(inspect(validWebContentsView)).toBe(validWebContentsView.preloadPath);
  });
});

// ---------------------------------------------------------------------------
// Sanity: schema is a Zod schema
// ---------------------------------------------------------------------------

describe('IntegrationManifestSchema — sanity', () => {
  it('is a Zod schema instance', () => {
    expect(IntegrationManifestSchema).toBeInstanceOf(z.ZodType);
  });
});
