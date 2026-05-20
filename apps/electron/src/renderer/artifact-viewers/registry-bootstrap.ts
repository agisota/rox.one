/**
 * registry-bootstrap — PZD-37 Wave 11.
 *
 * Bootstraps the ArtifactViewerRegistry with all 6 viewer adapters.
 * Each adapter module is loaded lazily (only when registry is first queried).
 *
 * Usage:
 *   import { getArtifactViewerRegistry } from './artifact-viewers/registry-bootstrap'
 *   const registry = getArtifactViewerRegistry()
 *   const adapter = await registry.resolveByMime('text/markdown')
 */
import { ArtifactViewerRegistry } from '@rox-one/artifact-viewer-core'
import { registerMdAdapter } from '@rox-one/artifact-viewer-md/register'
import { registerBrowserAdapter } from '@rox-one/artifact-viewer-browser/register'
import { registerDocxAdapter } from '@rox-one/artifact-viewer-docx/register'
import { registerXlsxAdapter } from '@rox-one/artifact-viewer-xlsx/register'
import { registerPptxAdapter } from '@rox-one/artifact-viewer-pptx/register'
import { registerFigmaAdapter } from '@rox-one/artifact-viewer-figma/register'

/**
 * Creates a fresh ArtifactViewerRegistry with all 6 adapters registered.
 * Adapter implementation modules are loaded lazily by the registry on first
 * resolveByMime call — this function only registers factory thunks.
 */
export async function bootstrapArtifactViewerRegistry(): Promise<ArtifactViewerRegistry> {
  const registry = new ArtifactViewerRegistry()
  registerMdAdapter(registry)
  registerBrowserAdapter(registry)
  registerDocxAdapter(registry)
  registerXlsxAdapter(registry)
  registerPptxAdapter(registry)
  registerFigmaAdapter(registry)
  return registry
}

/** Singleton instance — initialised on first call. */
let _instance: ArtifactViewerRegistry | null = null

/**
 * Returns the singleton ArtifactViewerRegistry, creating and bootstrapping it
 * on the first call. Subsequent calls return the same instance immediately.
 */
export function getArtifactViewerRegistry(): ArtifactViewerRegistry {
  if (_instance === null) {
    _instance = new ArtifactViewerRegistry()
    registerMdAdapter(_instance)
    registerBrowserAdapter(_instance)
    registerDocxAdapter(_instance)
    registerXlsxAdapter(_instance)
    registerPptxAdapter(_instance)
    registerFigmaAdapter(_instance)
  }
  return _instance
}
