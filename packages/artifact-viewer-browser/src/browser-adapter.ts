/**
 * Browser artifact viewer adapter (renderer-side only).
 *
 * This adapter handles text/html and application/xhtml+xml artifacts by
 * rendering a placeholder div that the main process will attach a BrowserView
 * to. The actual BrowserView creation lives on the main-process side (future
 * ticket). The IPC contract exposed here is:
 *
 *   artifact:browser:request-attach  — posted from the placeholder on mount
 *   artifact:browser:export-{target} — IPC channel for PDF/PNG/HTML export
 *
 * Security note: no user content is injected into the DOM by this adapter.
 * The placeholder element only carries data attributes and dispatches a
 * postMessage; all actual rendering happens inside the isolated BrowserView.
 */
import { createElement, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ArtifactAdapter, ExportTarget } from '@rox-one/artifact-viewer-core';
import type { BrowserViewOpts, BrowserExportTarget } from './types.ts';

const SUPPORTED_MIMES = new Set(['text/html', 'application/xhtml+xml']);

const DEFAULT_PARTITION = 'persist:rox-artifact-browser';

const VALID_BROWSER_TARGETS = new Set<BrowserExportTarget>(['html', 'pdf', 'png']);

/**
 * Stable container ID derived from the URI.
 * Uses a simple djb2-style hash so it is deterministic and DOM-id-safe.
 */
function hashUri(uri: string): string {
  let h = 5381;
  for (let i = 0; i < uri.length; i++) {
    h = ((h << 5) + h) ^ uri.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return `rox-browser-view-${h.toString(16)}`;
}

/**
 * Placeholder component that signals the main process to attach a BrowserView.
 *
 * On mount it fires a postMessage carrying the container id, URI, bounds, and
 * partition so the main-process IPC handler can position and attach the view.
 */
function BrowserPlaceholder({
  id,
  uri,
  opts,
}: {
  id: string;
  uri: string;
  opts: BrowserViewOpts;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const bounds = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width || opts.size.width),
      height: Math.round(rect.height || opts.size.height),
    };

    window.postMessage(
      {
        type: 'artifact:browser:request-attach',
        id,
        uri,
        bounds,
        partition: opts.partition || DEFAULT_PARTITION,
      },
      '*',
    );

    return () => {
      // Notify main process to detach when the component unmounts.
      window.postMessage({ type: 'artifact:browser:detach', id }, '*');
    };
  }, [id, uri, opts]);

  return createElement('div', {
    ref,
    id,
    'data-artifact-viewer': 'browser',
    'data-artifact-uri': uri,
    'data-partition': opts.partition || DEFAULT_PARTITION,
    style: {
      width: '100%',
      height: '100%',
      background: 'transparent',
      position: 'relative',
    },
  });
}

export class BrowserAdapter implements ArtifactAdapter {
  readonly kind = 'browser';

  canRender(mime: string): boolean {
    return SUPPORTED_MIMES.has(mime);
  }

  render(uri: string, opts: BrowserViewOpts): ReactNode {
    const id = hashUri(uri);
    return createElement(BrowserPlaceholder, { key: id, id, uri, opts });
  }

  async export(uri: string, target: ExportTarget): Promise<Blob> {
    if (!VALID_BROWSER_TARGETS.has(target as BrowserExportTarget)) {
      throw new Error(`unsupported export target: ${target}`);
    }

    // Delegate to the main-process IPC handler.
    // In Electron renderer context, window.electron.ipcRenderer.invoke is
    // injected via contextBridge. We access it defensively so unit tests
    // (which run in Node/bun without contextBridge) can mock it.
    const ipc = (
      window as unknown as {
        electron?: { ipcRenderer?: { invoke(channel: string, ...args: unknown[]): Promise<unknown> } };
      }
    ).electron?.ipcRenderer;

    if (!ipc) {
      throw new Error(`artifact:browser:export-${target}: IPC bridge not available`);
    }

    const result = await ipc.invoke(`artifact:browser:export-${target}`, { uri });

    if (result instanceof Blob) {
      return result;
    }

    // Accept ArrayBuffer / Uint8Array from IPC serialisation.
    if (result instanceof ArrayBuffer || ArrayBuffer.isView(result)) {
      const mimeMap: Record<BrowserExportTarget, string> = {
        pdf: 'application/pdf',
        png: 'image/png',
        html: 'text/html',
      };
      return new Blob([result as BufferSource], { type: mimeMap[target as BrowserExportTarget] });
    }

    throw new Error(`artifact:browser:export-${target}: unexpected IPC response type`);
  }
}
