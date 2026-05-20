/**
 * Figma artifact viewer adapter — STUB awaiting plugin approval.
 *
 * Full embed requires:
 *   1. Figma plugin approval via https://www.figma.com/developers/api#plugins
 *   2. `embed_host` registration in the Figma embed API allowlist
 *      (see https://www.figma.com/developers/embed — `embed_host` param is
 *      required; unapproved hosts render an error iframe instead of the file).
 *
 * Until approval is granted, this adapter renders a fallback card with an
 * external link to open the file in Figma directly. Tracked as PZD-101 follow-up.
 */
import { createElement } from 'react';
import type { ReactNode } from 'react';
import type { ArtifactAdapter, ViewOpts, ExportTarget } from '@rox-one/artifact-viewer-core/types';

const FIGMA_MIME = 'application/x-figma';

/** Matches https://figma.com/file/... and https://www.figma.com/design/... */
const FIGMA_URI_RE = /^https:\/\/(www\.)?figma\.com\/(file|design)\//;

export class FigmaAdapter implements ArtifactAdapter {
  readonly kind = 'figma';

  canRender(mime: string): boolean {
    return mime === FIGMA_MIME || FIGMA_URI_RE.test(mime);
  }

  render(uri: string, _opts: ViewOpts): ReactNode {
    // Fallback card — shown until Figma plugin approval + embed_host registration.
    // TODO(PZD-101): replace with <iframe src="https://www.figma.com/embed?embed_host=<approved-host>&url={uri}" />
    //   once embed_host is registered with Figma.
    return createElement(
      'div',
      {
        'data-artifact-viewer': 'figma',
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '2rem',
          height: '100%',
          boxSizing: 'border-box' as const,
          background: 'var(--rox-bg)',
          color: 'var(--rox-fg)',
          fontFamily: 'system-ui, sans-serif',
        },
      },
      createElement(
        'p',
        { style: { margin: 0, textAlign: 'center' as const } },
        'Figma preview — sign in to Figma to enable',
      ),
      createElement(
        'a',
        {
          href: uri,
          target: '_blank',
          rel: 'noopener noreferrer',
          style: {
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            background: 'var(--rox-accent, #18a0fb)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.875rem',
          },
        },
        'Open in Figma ↗',
      ),
    );
  }

  async export(_uri: string, _target: ExportTarget): Promise<Blob> {
    // Full export (PDF/PNG/native) requires Figma plugin approval.
    // See: https://www.figma.com/developers/api#exports
    throw new Error(
      'figma export requires Figma plugin approval — PZD-101 follow-up',
    );
  }
}
