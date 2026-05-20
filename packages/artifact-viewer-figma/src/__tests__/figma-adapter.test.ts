import { describe, it, expect } from 'bun:test';
import { FigmaAdapter } from '../figma-adapter.ts';

describe('FigmaAdapter', () => {
  const adapter = new FigmaAdapter();

  it('canRender returns true for application/x-figma MIME', () => {
    expect(adapter.canRender('application/x-figma')).toBe(true);
  });

  it('canRender returns true for figma.com/file URI', () => {
    expect(
      adapter.canRender('https://www.figma.com/file/abc123/My-Design'),
    ).toBe(true);
  });

  it('canRender returns true for figma.com/design URI', () => {
    expect(
      adapter.canRender('https://figma.com/design/xyz789/Component-Kit'),
    ).toBe(true);
  });

  it('canRender returns false for non-figma MIME', () => {
    expect(adapter.canRender('text/markdown')).toBe(false);
    expect(adapter.canRender('application/pdf')).toBe(false);
    expect(adapter.canRender('https://example.com/file/foo')).toBe(false);
  });

  it('render returns a fallback card React node containing the sign-in message and an external link', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');

    const uri = 'https://www.figma.com/file/abc123/My-Design';
    const node = adapter.render(uri, {
      theme: 'light',
      size: { width: 800, height: 600 },
      signal: new AbortController().signal,
      partition: '',
      locale: 'en',
    });

    expect(node).not.toBeNull();
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('Figma preview');
    expect(html).toContain('sign in to Figma');
    expect(html).toContain(`href="${uri}"`);
    expect(html).toContain('Open in Figma');
  });

  it('export rejects with documented plugin-approval error', async () => {
    const uri = 'https://www.figma.com/file/abc123/My-Design';
    await expect(adapter.export(uri, 'pdf')).rejects.toThrow(
      'figma export requires Figma plugin approval — PZD-101 follow-up',
    );
  });
});
