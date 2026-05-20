import type { ReactNode } from 'react';

export interface ViewOpts {
  /** Theme inherited from app shell. */
  theme: 'light' | 'dark';
  /** Viewer panel size at render time. */
  size: { width: number; height: number };
  /** Abort signal for slow renders. */
  signal: AbortSignal;
  /** Sandboxed partition name owned by the parent panel. */
  partition: string;
  /** Locale for localized rendering. */
  locale: string;
}

export type ExportTarget = 'pdf' | 'png' | 'html' | 'native';

export interface ArtifactAdapter {
  /** Adapter identifier — e.g. "md", "docx", "figma". */
  readonly kind: string;

  /** True if this adapter can render the artifact (MIME-based dispatch). */
  canRender(mime: string): boolean;

  /** Render the artifact into a React element for the viewer panel. */
  render(uri: string, opts: ViewOpts): ReactNode;

  /** Export to a target format (PDF/PNG/HTML/native). Optional. */
  export?(uri: string, target: ExportTarget): Promise<Blob>;
}
