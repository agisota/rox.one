import { describe, it, expect } from 'bun:test';
import { ArtifactViewerRegistry } from '../registry.ts';
import type { ArtifactAdapter, ViewOpts } from '../types.ts';

function makeAdapter(kind: string, mimes: string[]): ArtifactAdapter {
  return {
    kind,
    canRender: (mime: string) => mimes.includes(mime),
    render: (_uri: string, _opts: ViewOpts) => null,
  };
}

describe('ArtifactViewerRegistry', () => {
  // Cycle 1 RED: register + resolveByMime returns adapter
  it('resolveByMime returns the registered adapter for a known MIME', async () => {
    const registry = new ArtifactViewerRegistry();
    const adapter = makeAdapter('md', ['text/markdown']);
    registry.register(() => Promise.resolve(adapter));

    const result = await registry.resolveByMime('text/markdown');
    expect(result).toBe(adapter);
  });

  // Cycle 3 RED: resolveByMime returns null for unknown mime
  it('resolveByMime returns null for an unknown MIME type', async () => {
    const registry = new ArtifactViewerRegistry();
    const adapter = makeAdapter('md', ['text/markdown']);
    registry.register(() => Promise.resolve(adapter));

    const result = await registry.resolveByMime('application/pdf');
    expect(result).toBeNull();
  });

  it('resolveByMime loads the adapter only once (factory called once per adapter)', async () => {
    const registry = new ArtifactViewerRegistry();
    let callCount = 0;
    const adapter = makeAdapter('md', ['text/markdown', 'text/x-markdown']);
    registry.register(() => {
      callCount++;
      return Promise.resolve(adapter);
    });

    await registry.resolveByMime('text/markdown');
    await registry.resolveByMime('text/x-markdown');
    expect(callCount).toBe(1);
  });

  it('resolveByMime supports multiple registered adapters', async () => {
    const registry = new ArtifactViewerRegistry();
    const mdAdapter = makeAdapter('md', ['text/markdown']);
    const htmlAdapter = makeAdapter('browser', ['text/html']);
    registry.register(() => Promise.resolve(mdAdapter));
    registry.register(() => Promise.resolve(htmlAdapter));

    expect(await registry.resolveByMime('text/markdown')).toBe(mdAdapter);
    expect(await registry.resolveByMime('text/html')).toBe(htmlAdapter);
  });
});
