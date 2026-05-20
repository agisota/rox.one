import { describe, it, expect } from 'bun:test';
import { DocxAdapter, DocxExportError } from '../docx-adapter.ts';

/**
 * Minimal valid 3-paragraph .docx fixture encoded as base64.
 * Generated via JSZip with OOXML structure:
 *   Para 1: "Hello from paragraph one."
 *   Para 2: "This is paragraph two."
 *   Para 3: "And paragraph three ends the doc."
 */
const FIXTURE_B64 =
  'UEsDBAoAAAAAAP02tFzXeYTquAEAALgBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPgogIDxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+CiAgPERlZmF1bHQgRXh0ZW5zaW9uPSJ4bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi94bWwiLz4KICA8T3ZlcnJpZGUgUGFydE5hbWU9Ii93b3JkL2RvY3VtZW50LnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Lm1haW4reG1sIi8+CjwvVHlwZXM+UEsDBAoAAAAAAP02tFwAAAAAAAAAAAAAAAAGAAAAX3JlbHMvUEsDBAoAAAAAAP02tFwgG4bqLgEAAC4BAAALAAAAX3JlbHMvLnJlbHM8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+CjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPgogIDxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0id29yZC9kb2N1bWVudC54bWwiLz4KPC9SZWxhdGlvbnNoaXBzPlBLAwQKAAAAAAD9NrRcAAAAAAAAAAAAAAAABQAAAHdvcmQvUEsDBAoAAAAAAP02tFwAAAAAAAAAAAAAAAALAAAAd29yZC9fcmVscy9QSwMECgAAAAAA/Ta0XIwOhdCdAAAAnQAAABwAAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj4KPC9SZWxhdGlvbnNoaXBzPlBLAwQKAAAAAAD9NrRc3ntRecMBAADDAQAAEQAAAHdvcmQvZG9jdW1lbnQueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8dzpkb2N1bWVudCB4bWxuczp3cGM9Imh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vb2ZmaWNlL3dvcmQvMjAxMC93b3JkcHJvY2Vzc2luZ0NhbnZhcyIKICB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iPgogIDx3OmJvZHk+CiAgICA8dzpwPjx3OnI+PHc6dD5IZWxsbyBmcm9tIHBhcmFncmFwaCBvbmUuPC93OnQ+PC93OnI+PC93OnA+CiAgICA8dzpwPjx3OnI+PHc6dD5UaGlzIGlzIHBhcmFncmFwaCB0d28uPC93OnQ+PC93OnI+PC93OnA+CiAgICA8dzpwPjx3OnI+PHc6dD5BbmQgcGFyYWdyYXBoIHRocmVlIGVuZHMgdGhlIGRvYy48L3c6dD48L3c6cj48L3c6cD4KICA8L3c6Ym9keT4KPC93OmRvY3VtZW50PlBLAQIUAAoAAAAAAP02tFzXeYTquAEAALgBAAATAAAAAAAAAAAAAAAAAAAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQACgAAAAAA/Ta0XAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAQAAAA6QEAAF9yZWxzL1BLAQIUAAoAAAAAAP02tFwgG4bqLgEAAC4BAAALAAAAAAAAAAAAAAAAAA0CAABfcmVscy8ucmVsc1BLAQIUAAoAAAAAAP02tFwAAAAAAAAAAAAAAAAFAAAAAAAAAAAAEAAAAGQDAAB3b3JkL1BLAQIUAAoAAAAAAP02tFwAAAAAAAAAAAAAAAALAAAAAAAAAAAAEAAAAIcDAAB3b3JkL19yZWxzL1BLAQIUAAoAAAAAAP02tFyMDoXQnQAAAJ0AAAAcAAAAAAAAAAAAAAAAALADAAB3b3JkL19yZWxzL2RvY3VtZW50LnhtbC5yZWxzUEsBAhQACgAAAAAA/Ta0XN57UXnDAQAAwwEAABEAAAAAAAAAAAAAAAAAhwQAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAAHAAcAowEAAHkGAAAAAA==';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FIXTURE_URI = `data:${DOCX_MIME};base64,${FIXTURE_B64}`;

const DEFAULT_OPTS = {
  theme: 'light' as const,
  size: { width: 800, height: 600 },
  signal: new AbortController().signal,
  partition: 'persist:rox-artifact-docx',
  locale: 'en',
};

describe('DocxAdapter', () => {
  const adapter = new DocxAdapter();

  // --- canRender ---

  it('canRender returns true for the DOCX MIME type', () => {
    expect(adapter.canRender(DOCX_MIME)).toBe(true);
  });

  it('canRender returns true for strings ending with .docx', () => {
    expect(adapter.canRender('application/octet-stream; ext=.docx')).toBe(true);
    expect(adapter.canRender('.docx')).toBe(true);
  });

  it('canRender returns false for unrelated MIME types', () => {
    expect(adapter.canRender('text/markdown')).toBe(false);
    expect(adapter.canRender('application/pdf')).toBe(false);
    expect(adapter.canRender('text/html')).toBe(false);
  });

  // --- render (sync placeholder) + CSS vars ---

  it('render returns a React element referencing --rox-bg and --rox-fg CSS vars', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const node = adapter.render(FIXTURE_URI, DEFAULT_OPTS);
    expect(node).not.toBeNull();
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('--rox-bg');
    expect(html).toContain('--rox-fg');
  });

  // --- renderAsync: converts fixture to HTML with <p> elements ---

  it('renderAsync converts the fixture docx to HTML containing <p> elements', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const node = await adapter.renderAsync(FIXTURE_URI, DEFAULT_OPTS);
    expect(node).not.toBeNull();
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('<p>');
    expect(html).toContain('paragraph one');
  });

  // --- export html ---

  it('export html returns a Blob starting with <!DOCTYPE html> and containing doc text', async () => {
    const blob = await adapter.export(FIXTURE_URI, 'html');
    const text = await blob.text();
    expect(text.toLowerCase()).toContain('<!doctype html>');
    expect(text).toContain('paragraph one');
    expect(text).toContain('--rox-bg');
  });

  // --- export pdf (IPC stub) ---

  it('export pdf returns a non-empty Blob with type application/pdf', async () => {
    const blob = await adapter.export(FIXTURE_URI, 'pdf');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  // --- unsupported export target ---

  it('export throws DocxExportError for unsupported targets', async () => {
    await expect(
      adapter.export(FIXTURE_URI, 'png' as Parameters<typeof adapter.export>[1]),
    ).rejects.toBeInstanceOf(DocxExportError);
  });
});
