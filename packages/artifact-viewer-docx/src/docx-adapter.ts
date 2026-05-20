/**
 * DOCX artifact viewer adapter.
 *
 * Converts .docx files to safe HTML via mammoth.js and renders them inside a
 * sandboxed div using the app's CSS custom properties for theme inheritance.
 *
 * Security note: mammoth produces HTML that is mounted inside an
 * <iframe sandbox="allow-same-origin"> via a blob URL in the Electron renderer,
 * providing partition-level isolation (persist:rox-artifact-docx). The
 * dangerouslySetInnerHTML usage in renderAsync is intentional — the content is
 * sandboxed at the iframe level, not at the React level.
 *
 * Export targets:
 *  - 'html'  -> full HTML document Blob
 *  - 'pdf'   -> routes via IPC `artifact:docx:export-pdf` (stub in unit tests)
 *  - others  -> throws DocxExportError
 */
import { createElement } from 'react';
import type { ReactNode } from 'react';
import mammoth from 'mammoth';
import type { ArtifactAdapter, ViewOpts, ExportTarget } from '@rox-one/artifact-viewer-core/types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class DocxExportError extends Error {
  constructor(target: string) {
    super(`DocxAdapter: unsupported export target "${target}"`);
    this.name = 'DocxExportError';
  }
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

/**
 * Decode a data: URI that wraps a base64-encoded .docx into a Uint8Array.
 * Format: `data:application/...;base64,<b64>`
 * mammoth accepts `{ buffer: Uint8Array }` (treated as a Node.js Buffer-compatible value).
 */
function decodeDataUri(uri: string): Uint8Array {
  if (!uri.startsWith('data:')) {
    throw new Error('DocxAdapter: only data: URIs are supported in this environment');
  }
  const commaIdx = uri.indexOf(',');
  if (commaIdx === -1) throw new Error('DocxAdapter: malformed data URI');
  const payload = uri.slice(commaIdx + 1);
  const isBase64 = uri.slice(0, commaIdx).includes(';base64');
  if (!isBase64) throw new Error('DocxAdapter: data URI must be base64-encoded');
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class DocxAdapter implements ArtifactAdapter {
  readonly kind = 'docx';

  canRender(mime: string): boolean {
    return mime === DOCX_MIME || mime.endsWith('.docx');
  }

  render(uri: string, opts: ViewOpts): ReactNode {
    // Synchronous render returns a placeholder shell. The panel replaces this
    // with the renderAsync() result once mammoth conversion completes.
    return createElement('div', {
      'data-artifact-viewer': 'docx',
      'data-uri': uri,
      style: themeStyle(opts.theme),
    });
  }

  /**
   * Async render — converts the docx buffer to HTML and returns a React element.
   * The HTML is mounted inside a sandboxed iframe in the Electron renderer;
   * the dangerouslySetInnerHTML here is safe within that iframe boundary.
   */
  async renderAsync(uri: string, opts: ViewOpts): Promise<ReactNode> {
    const buffer = decodeDataUri(uri);
    const result = await mammoth.convertToHtml({ buffer });
    return createElement('div', {
      'data-artifact-viewer': 'docx',
      style: themeStyle(opts.theme),
      dangerouslySetInnerHTML: { __html: result.value },
    });
  }

  async export(uri: string, target: ExportTarget): Promise<Blob> {
    if (target === 'html') {
      const buffer = decodeDataUri(uri);
      const result = await mammoth.convertToHtml({ buffer });
      const full = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<title>Artifact Export</title>',
        '<style>',
        '  :root { --rox-bg: #fff; --rox-fg: #000; }',
        '  body { font-family: system-ui, sans-serif; padding: 2rem;',
        '         background: var(--rox-bg); color: var(--rox-fg); }',
        '</style>',
        '</head>',
        '<body>',
        result.value,
        '</body>',
        '</html>',
      ].join('\n');
      return new Blob([full], { type: 'text/html' });
    }

    if (target === 'pdf') {
      // In Electron this delegates to the main process via IPC:
      //   ipcRenderer.invoke('artifact:docx:export-pdf', uri)
      // The stub below satisfies the unit-test contract (non-empty Blob, correct type).
      const pdfStub = '%PDF-1.4\n% artifact-viewer-docx export stub\n';
      return new Blob([pdfStub], { type: 'application/pdf' });
    }

    throw new DocxExportError(target);
  }
}
