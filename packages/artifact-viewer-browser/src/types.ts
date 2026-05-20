import type { ViewOpts } from '@rox-one/artifact-viewer-core';

/** Bounding rectangle for the BrowserView overlay (main-process side). */
export interface BrowserViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Options passed to BrowserAdapter.render().
 * Extends the shared ViewOpts with browser-specific fields.
 *
 * Note: `partition` is inherited from ViewOpts (required). The default value
 * 'persist:rox-artifact-browser' is applied at the call site when callers omit
 * it via the convenience helper in browser-adapter.ts.
 */
export interface BrowserViewOpts extends ViewOpts {
  /** Whether to sandbox the BrowserView (default: true). */
  sandbox?: boolean;
  /** Whether to enable JavaScript inside the BrowserView (default: false). */
  allowJavaScript?: boolean;
}

/**
 * Supported export target formats for the browser adapter.
 * The main-process IPC handler resolves each via:
 *   artifact:browser:export-{pdf|png|html}
 */
export type BrowserExportTarget = 'html' | 'pdf' | 'png';
