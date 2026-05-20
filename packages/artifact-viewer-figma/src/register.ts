/**
 * Renderer-side initialization — registers the Figma adapter into the
 * provided ArtifactViewerRegistry.
 *
 * Usage:
 *   import { registerFigmaAdapter } from '@rox-one/artifact-viewer-figma/register';
 *   registerFigmaAdapter(registry);
 *
 * Note: adapter renders a fallback card until Figma plugin approval +
 * embed_host registration are complete (PZD-101 follow-up).
 */
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core';

export function registerFigmaAdapter(registry: ArtifactViewerRegistry): void {
  registry.register(() =>
    import('./figma-adapter.ts').then((m) => new m.FigmaAdapter()),
  );
}
