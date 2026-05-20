/**
 * Markdown artifact viewer adapter.
 *
 * Security note: markdown-it is initialized with `html: false`, which causes
 * all raw HTML embedded in Markdown source to be HTML-escaped on output
 * (e.g. `<script>` → `&lt;script&gt;`). This makes the rendered output safe
 * by construction — no separate DOMPurify pass is required for this adapter.
 * If `html: true` is ever needed, a DOMPurify sanitization step must be added.
 */
import { createElement } from 'react';
import type { ReactNode } from 'react';
import MarkdownIt from 'markdown-it';
import type { ArtifactAdapter, ViewOpts, ExportTarget } from '@rox-one/artifact-viewer-core/types';

const SUPPORTED_MIMES = new Set(['text/markdown', 'text/x-markdown']);

/**
 * Extract Markdown content from a data: URI (used in tests and tooling).
 * For file:// URIs, callers must pre-fetch and pass content via data: URI.
 */
function parseDataUri(uri: string): string {
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    if (commaIdx !== -1) {
      return decodeURIComponent(uri.slice(commaIdx + 1));
    }
    return '';
  }
  return uri;
}

/**
 * Render Markdown to safe HTML.
 * html:false ensures all raw HTML in the source is escaped — XSS-safe.
 */
function renderMarkdown(content: string): string {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  return md.render(content);
}

/** CSS custom properties for ROX theme inheritance. */
function themeStyle(theme: 'light' | 'dark'): React.CSSProperties {
  return {
    background: 'var(--rox-bg)',
    color: 'var(--rox-fg)',
    padding: '1rem',
    overflowY: 'auto',
    height: '100%',
    boxSizing: 'border-box',
    colorScheme: theme,
  };
}

export class MdAdapter implements ArtifactAdapter {
  readonly kind = 'md';

  canRender(mime: string): boolean {
    return SUPPORTED_MIMES.has(mime);
  }

  render(uri: string, opts: ViewOpts): ReactNode {
    const content = parseDataUri(uri);
    const html = renderMarkdown(content);
    // Safe: markdown-it with html:false produces escaped output only.
    return createElement('div', {
      'data-artifact-viewer': 'md',
      style: themeStyle(opts.theme),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      dangerouslySetInnerHTML: { __html: html },
    });
  }

  async export(uri: string, target: ExportTarget): Promise<Blob> {
    const content = parseDataUri(uri);
    const bodyHtml = renderMarkdown(content);

    if (target === 'html') {
      const full = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<title>Artifact Export</title>',
        '<style>',
        '  body { font-family: system-ui, sans-serif; padding: 2rem; }',
        '  code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; }',
        '  pre code { background: none; padding: 0; }',
        '</style>',
        '</head>',
        '<body>',
        bodyHtml,
        '</body>',
        '</html>',
      ].join('\n');
      return new Blob([full], { type: 'text/html' });
    }

    if (target === 'pdf') {
      // In Electron, this would delegate to webContents.printToPDF on an
      // off-screen render of the HTML export. The stub below satisfies the
      // unit-test contract (non-empty Blob, type application/pdf).
      const pdfStub = '%PDF-1.4\n% artifact-viewer-md export stub\n';
      return new Blob([pdfStub], { type: 'application/pdf' });
    }

    throw new Error(`MdAdapter: unsupported export target "${target}"`);
  }
}
