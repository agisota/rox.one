/**
 * Renderer-side initialization — registers the PPTX adapter into the
 * provided ArtifactViewerRegistry.
 *
 * Usage:
 *   import { registerPptxAdapter } from '@rox-one/artifact-viewer-pptx/register';
 *   registerPptxAdapter(registry);
 */
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core';

export function registerPptxAdapter(registry: ArtifactViewerRegistry): void {
  registry.register(() =>
    import('./pptx-adapter.ts').then((m) => new m.PptxAdapter()),
  );
}
