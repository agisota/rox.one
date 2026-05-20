import { describe, it, expect } from 'bun:test';
import { PptxAdapter, UnsupportedPptxExportTarget } from '../pptx-adapter.ts';

describe('PptxAdapter', () => {
  const adapter = new PptxAdapter();

  const baseOpts = {
    theme: 'light' as const,
    size: { width: 800, height: 600 },
    signal: new AbortController().signal,
    partition: '',
    locale: 'en',
  };

  // Test 1: canRender — PPTX MIME
  it('canRender returns true for PPTX MIME type', () => {
    expect(
      adapter.canRender(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toBe(true);
  });

  // Test 2: canRender — .pptx sentinel
  it('canRender returns true for .pptx extension sentinel', () => {
    expect(adapter.canRender('.pptx')).toBe(true);
  });

  // Test 3: render produces slide-deck container with data-artifact-viewer attribute
  it('render produces a slide-deck container element', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const slides = [
      { index: 0, title: 'Intro', bodyText: 'Hello world' },
      { index: 1, title: 'Details', bodyText: 'More info' },
    ];

    const node = adapter.render('data:application/pptx,', {
      ...baseOpts,
      __slides: slides,
    } as typeof baseOpts & { __slides: typeof slides });

    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('data-artifact-viewer="pptx"');
    expect(html).toContain('slide-deck');
    expect(html).toContain('Intro');
  });

  // Test 4: navigation indices — counter shows "1 of N"
  it('render includes slide counter showing 1 of N', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const slides = [
      { index: 0, title: 'First', bodyText: '' },
      { index: 1, title: 'Second', bodyText: '' },
      { index: 2, title: 'Third', bodyText: '' },
    ];

    const node = adapter.render('data:application/pptx,', {
      ...baseOpts,
      __slides: slides,
    } as typeof baseOpts & { __slides: typeof slides });

    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('1 of 3');
    expect(html).toContain('slide-counter');
    expect(html).toContain('slide-prev');
    expect(html).toContain('slide-next');
  });

  // Test 5: export pdf routes via IPC channel (stub path returns pdf blob)
  it('export pdf returns a Blob with type application/pdf', async () => {
    const blob = await adapter.export('data:application/pptx,', 'pdf');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  // Test 6: export png-slides routes via IPC channel (stub path returns image/png blob)
  it('export png-slides returns a Blob with type image/png', async () => {
    const blob = await adapter.export('data:application/pptx,', 'png-slides');
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  // Test 7: unsupported target throws UnsupportedPptxExportTarget
  it('export with unsupported target throws UnsupportedPptxExportTarget', async () => {
    await expect(adapter.export('data:application/pptx,', 'mp4')).rejects.toBeInstanceOf(
      UnsupportedPptxExportTarget,
    );
  });
});
