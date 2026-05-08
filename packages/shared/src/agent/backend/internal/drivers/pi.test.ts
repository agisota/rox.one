import { describe, expect, it } from 'bun:test';
import { piDriver } from './pi.ts';

describe('piDriver.buildRuntime custom endpoint models', () => {
  it('preserves explicit per-model supportsImages values', () => {
    const runtime = piDriver.buildRuntime({
      context: {
        provider: 'pi',
        authType: 'api_key',
        resolvedModel: 'vision-model',
        capabilities: { needsHttpPoolServer: false },
        connection: {
          slug: 'custom-endpoint',
          name: 'Custom Endpoint',
          providerType: 'pi',
          authType: 'api_key',
          baseUrl: 'http://127.0.0.1:11111/v1',
          customEndpoint: { api: 'anthropic-messages', supportsImages: true },
          models: [
            { id: 'vision-model', contextWindow: 262_144, supportsImages: true },
            { id: 'text-only-model', supportsImages: false },
            { id: 'plain-model' },
          ],
          createdAt: Date.now(),
        } as any,
      },
      coreConfig: {} as any,
      hostRuntime: {} as any,
      resolvedPaths: {
        piServerPath: '/tmp/pi-agent-server.js',
        interceptorBundlePath: '/tmp/interceptor.cjs',
        nodeRuntimePath: '/usr/bin/node',
      },
    });

    expect(runtime.customModels).toEqual([
      { id: 'vision-model', contextWindow: 262_144, supportsImages: true },
      { id: 'text-only-model', supportsImages: false },
      'plain-model',
    ]);
  });
});

describe('piDriver dependency risk guard', () => {
  it('rejects model discovery in public-untrusted mode before SDK-backed registry access', async () => {
    const previousMode = process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE;
    process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE = 'public-untrusted';

    try {
      await expect(piDriver.fetchModels?.({
        connection: {
          slug: 'pi-public',
          name: 'PI Public',
          providerType: 'pi',
          authType: 'none',
          createdAt: Date.now(),
        } as any,
        credentials: {},
        hostRuntime: {
          appRootPath: process.cwd(),
          isPackaged: false,
        },
        resolvedPaths: {},
        timeoutMs: 1_000,
      })).rejects.toThrow('PI provider runtime is disabled for public untrusted exposure');
    } finally {
      if (previousMode === undefined) {
        delete process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE;
      } else {
        process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE = previousMode;
      }
    }
  });
});

describe('piDriver.testConnection', () => {
  it('keeps Anthropic-compatible endpoint resolution available through the lazy registry path', async () => {
    const previousMode = process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE;
    const previousFetch = globalThis.fetch;
    const requests: Array<{ url: string; init?: RequestInit }> = [];

    process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE = 'private-local';
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      requests.push({ url: String(input), init });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const result = await piDriver.testConnection?.({
        provider: 'pi',
        apiKey: 'sk-test',
        model: 'pi/claude-3-5-haiku-20241022',
        connection: {
          providerType: 'pi',
          piAuthProvider: 'anthropic',
        },
        hostRuntime: {
          appRootPath: process.cwd(),
          isPackaged: false,
        },
        resolvedPaths: {},
        timeoutMs: 1_000,
      });

      expect(result).toEqual({ success: true });
      expect(requests).toHaveLength(1);
      const request = requests[0];
      expect(request).toBeDefined();
      expect(request!.url).toBe('https://api.anthropic.com/v1/messages');
      expect(JSON.parse(request!.init?.body as string).model).toBe('claude-3-5-haiku-20241022');
    } finally {
      globalThis.fetch = previousFetch;
      if (previousMode === undefined) {
        delete process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE;
      } else {
        process.env.CRAFT_PI_PROVIDER_DEPENDENCY_RISK_MODE = previousMode;
      }
    }
  });
});
