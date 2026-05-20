/**
 * Renderer-side initialization — registers the Browser adapter into the
 * provided ArtifactViewerRegistry.
 *
 * Usage:
 *   import { registerBrowserAdapter } from '@rox-one/artifact-viewer-browser/register';
 *   registerBrowserAdapter(registry);
 *
 * The factory is lazy: the BrowserAdapter module is only loaded on the first
 * resolveByMime call that matches an HTML MIME type.
 */
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core';

export function registerBrowserAdapter(registry: ArtifactViewerRegistry): void {
  registry.register(() =>
    import('./browser-adapter.ts').then((m) => new m.BrowserAdapter()),
  );
}
