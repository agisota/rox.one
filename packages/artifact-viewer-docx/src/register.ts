/**
 * Renderer-side initialization — registers the DOCX adapter into the
 * provided ArtifactViewerRegistry.
 *
 * Usage:
 *   import { registerDocxAdapter } from '@rox-one/artifact-viewer-docx/register';
 *   registerDocxAdapter(registry);
 *
 * The factory is lazy: the DocxAdapter module is only loaded on the first
 * resolveByMime call that matches a DOCX MIME type.
 */
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core';

export function registerDocxAdapter(registry: ArtifactViewerRegistry): void {
  registry.register(() =>
    import('./docx-adapter.ts').then((m) => new m.DocxAdapter()),
  );
}
