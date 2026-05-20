import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BrowserAdapter } from '../browser-adapter.ts';

const BASE_OPTS = {
  theme: 'light' as const,
  size: { width: 800, height: 600 },
  signal: new AbortController().signal,
  partition: 'persist:rox-artifact-browser',
  locale: 'en',
};

describe('BrowserAdapter', () => {
  const adapter = new BrowserAdapter();

  // --- canRender ---

  it('canRender returns true for text/html', () => {
    expect(adapter.canRender('text/html')).toBe(true);
  });

  it('canRender returns true for application/xhtml+xml', () => {
    expect(adapter.canRender('application/xhtml+xml')).toBe(true);
  });

  it('canRender returns false for text/markdown', () => {
    expect(adapter.canRender('text/markdown')).toBe(false);
  });

  it('canRender returns false for application/pdf', () => {
    expect(adapter.canRender('application/pdf')).toBe(false);
  });

  // --- render ---

  it('render returns a non-null React node with a data-artifact-viewer attribute', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const node = adapter.render('https://example.com/index.html', BASE_OPTS);

    expect(node).not.toBeNull();
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('data-artifact-viewer="browser"');
  });

  it('render returns React node with stable container id (same uri → same id)', async () => {
    const uri = 'https://example.com/index.html';

    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const html1 = renderToStaticMarkup(
      adapter.render(uri, BASE_OPTS) as ReturnType<typeof createElement>,
    );
    const html2 = renderToStaticMarkup(
      adapter.render(uri, BASE_OPTS) as ReturnType<typeof createElement>,
    );

    // Same URI → same id
    expect(html1).toBe(html2);

    // Different URI → different id
    const htmlOther = renderToStaticMarkup(
      adapter.render('https://other.com/', BASE_OPTS) as ReturnType<typeof createElement>,
    );
    expect(html1).not.toBe(htmlOther);
  });

  // --- export: invalid target ---

  it('export rejects with "unsupported export target" for an invalid target', async () => {
    await expect(
      adapter.export('https://example.com/', 'native' as never),
    ).rejects.toThrow('unsupported export target: native');
  });

  // --- export: IPC delegation ---

  it('export pdf calls IPC artifact:browser:export-pdf and returns Blob', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const invokedChannels: string[] = [];

    // In bun test (Node context), globalThis.window is undefined.
    // The adapter reads window via (window as ...).electron, so we set globalThis.window.
    const saved = globalThis.window as unknown;
    (globalThis as unknown as { window: unknown }).window = {
      postMessage: () => {},
      electron: {
        ipcRenderer: {
          invoke: async (channel: string) => {
            invokedChannels.push(channel);
            return pdfBytes.buffer;
          },
        },
      },
    };

    try {
      const blob = await adapter.export('https://example.com/', 'pdf');
      expect(invokedChannels).toContain('artifact:browser:export-pdf');
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
    } finally {
      (globalThis as unknown as { window: unknown }).window = saved;
    }
  });

  it('export rejects when IPC bridge is not available', async () => {
    const saved = globalThis.window as unknown;
    (globalThis as unknown as { window: unknown }).window = { postMessage: () => {} };

    try {
      await expect(
        adapter.export('https://example.com/', 'pdf'),
      ).rejects.toThrow('IPC bridge not available');
    } finally {
      (globalThis as unknown as { window: unknown }).window = saved;
    }
  });

  it('partition is encoded as persist:rox-artifact-browser in rendered output', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const node = adapter.render('https://example.com/', BASE_OPTS);
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('persist:rox-artifact-browser');
  });

  it('render id attribute is a hex string prefixed with rox-browser-view-', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const node = adapter.render('https://example.com/', BASE_OPTS);
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toMatch(/id="rox-browser-view-[0-9a-f]+"/);
  });
});
