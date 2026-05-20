/**
 * Renderer-side initialization — registers the XLSX adapter into the
 * provided ArtifactViewerRegistry.
 *
 * Usage:
 *   import { registerXlsxAdapter } from '@rox-one/artifact-viewer-xlsx/register';
 *   registerXlsxAdapter(registry);
 *
 * The factory is lazy: the XlsxAdapter module is only loaded on the first
 * resolveByMime call that matches an XLSX MIME type.
 */
import type { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core';

export function registerXlsxAdapter(registry: ArtifactViewerRegistry): void {
  registry.register(() =>
    import('./xlsx-adapter.ts').then((m) => new m.XlsxAdapter()),
  );
}
