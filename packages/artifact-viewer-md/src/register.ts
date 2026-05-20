/**
 * Renderer-side initialization — registers the Markdown adapter into the
 * provided ArtifactViewerRegistry.
 *
 * Usage:
 *   import { registerMdAdapter } from '@rox-one/artifact-viewer-md/register';
 *   registerMdAdapter(registry);
 *
 * The factory is lazy: the MdAdapter module is only loaded on the first
 * resolveByMime call that matches a Markdown MIME type.
 */
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core';

export function registerMdAdapter(registry: ArtifactViewerRegistry): void {
  registry.register(() =>
    import('./md-adapter.ts').then((m) => new m.MdAdapter()),
  );
}
