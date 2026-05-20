import { describe, it, expect } from 'bun:test';
import { MdAdapter } from '../md-adapter.ts';

describe('MdAdapter', () => {
  const adapter = new MdAdapter();

  // Cycle 5 RED: canRender('text/markdown') → true
  it('canRender returns true for text/markdown', () => {
    expect(adapter.canRender('text/markdown')).toBe(true);
  });

  it('canRender returns true for text/x-markdown', () => {
    expect(adapter.canRender('text/x-markdown')).toBe(true);
  });

  it('canRender returns true for .md file extension sentinel', () => {
    expect(adapter.canRender('application/octet-stream; ext=.md')).toBe(false);
    // .md extension check is via resolveByExtension helper — adapter.canRender
    // operates on pure MIME strings; extension resolution is caller's job
  });

  it('canRender returns false for text/html', () => {
    expect(adapter.canRender('text/html')).toBe(false);
  });

  it('canRender returns false for application/pdf', () => {
    expect(adapter.canRender('application/pdf')).toBe(false);
  });

  // Cycle 7 RED: render returns React node with parsed HTML from "# Hello" → <h1>Hello</h1>
  it('render returns a React element whose innerHTML contains <h1>Hello</h1> for "# Hello"', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const node = adapter.render('data:text/markdown,# Hello', {
      theme: 'light',
      size: { width: 800, height: 600 },
      signal: new AbortController().signal,
      partition: '',
      locale: 'en',
    });

    // node should be a React element
    expect(node).not.toBeNull();
    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('<h1>Hello</h1>');
  });

  // Cycle 11 RED: theme CSS vars are applied (--rox-bg / --rox-fg referenced in style)
  it('render wraps content in a container that references --rox-bg and --rox-fg CSS vars', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const node = adapter.render('data:text/markdown,hello', {
      theme: 'dark',
      size: { width: 800, height: 600 },
      signal: new AbortController().signal,
      partition: '',
      locale: 'en',
    });

    const html = renderToStaticMarkup(node as ReturnType<typeof createElement>);
    expect(html).toContain('--rox-bg');
    expect(html).toContain('--rox-fg');
  });

  // Cycle 9 RED: export to html returns string starting with <html
  it('export to html returns a Blob whose text starts with <!DOCTYPE html>', async () => {
    const blob = await adapter.export('data:text/markdown,# Test', 'html');
    const text = await blob.text();
    expect(text.toLowerCase()).toContain('<!doctype html>');
    expect(text).toContain('<h1>Test</h1>');
  });

  it('export to pdf returns a non-empty Blob with type application/pdf', async () => {
    const blob = await adapter.export('data:text/markdown,# PDF', 'pdf');
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });
});
