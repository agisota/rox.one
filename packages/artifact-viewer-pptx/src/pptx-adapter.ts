/**
 * PowerPoint artifact viewer adapter.
 *
 * Parsing: jszip extracts the OOXML archive; slide titles and body text are
 * read from slide XML. Rendering: carousel of <div class="slide"> elements
 * with prev/next navigation.
 *
 * Export: routes through Electron IPC — real conversion (PDF/png-slides)
 * happens in the main process. This adapter sends the IPC call and awaits
 * the response blob. Unsupported targets throw a typed error immediately.
 */
import { createElement, useState } from 'react';
import type { ReactNode } from 'react';
import JSZip from 'jszip';
import type { ArtifactAdapter, ViewOpts } from '@rox-one/artifact-viewer-core/types';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPTX_EXT_MIME = '.pptx';

export type PptxExportTarget = 'pdf' | 'png-slides';

export class UnsupportedPptxExportTarget extends Error {
  readonly target: string;
  constructor(target: string) {
    super(`PptxAdapter: unsupported export target "${target}"`);
    this.name = 'UnsupportedPptxExportTarget';
    this.target = target;
  }
}

interface SlideData {
  index: number;
  title: string;
  bodyText: string;
}

/** Extract text content from XML nodes with the given tag name. */
function extractText(xml: string, tagName: string): string {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'g');
  const texts: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const inner = match[1] ?? '';
    texts.push(inner.replace(/<[^>]+>/g, '').trim());
  }
  return texts.filter(Boolean).join(' ');
}

/** Parse slide XML to extract title and first body paragraph. */
function parseSlide(xml: string, index: number): SlideData {
  const titleMatch = xml.match(
    /<p:sp>[\s\S]*?<p:ph[^>]+type="(?:title|ctrTitle)"[\s\S]*?<\/p:sp>/,
  );
  let title = '';
  if (titleMatch) {
    title = extractText(titleMatch[0], 'a:t');
  }

  const xmlWithoutTitle = titleMatch ? xml.replace(titleMatch[0], '') : xml;
  const bodyText = extractText(xmlWithoutTitle, 'a:t');

  return { index, title: title || `Slide ${index + 1}`, bodyText };
}

/** Decode a data: URI (base64) into bytes. */
async function loadBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    if (commaIdx === -1) return new Uint8Array(0);
    const b64 = uri.slice(commaIdx + 1);
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(0);
}

/** Parse a PPTX buffer via JSZip and return slide data array. */
async function parsePptx(bytes: Uint8Array): Promise<SlideData[]> {
  if (bytes.length === 0) return [];
  const zip = await JSZip.loadAsync(bytes);
  const slides: SlideData[] = [];

  const slideKeys = Object.keys(zip.files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => {
      const numA = parseInt(a.match(/(\d+)/)?.[1] ?? '0', 10);
      const numB = parseInt(b.match(/(\d+)/)?.[1] ?? '0', 10);
      return numA - numB;
    });

  for (let i = 0; i < slideKeys.length; i++) {
    const key = slideKeys[i];
    if (!key) continue;
    const file = zip.files[key];
    if (!file) continue;
    const xml = await file.async('text');
    slides.push(parseSlide(xml, i));
  }

  return slides;
}

/** Themed container style. */
function containerStyle(theme: 'light' | 'dark'): React.CSSProperties {
  return {
    background: 'var(--rox-bg)',
    color: 'var(--rox-fg)',
    height: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    colorScheme: theme,
  };
}

/** Carousel component using React hooks. */
function SlideCarousel({ slides }: { slides: SlideData[] }): ReactNode {
  const [current, setCurrent] = useState(0);
  const total = slides.length;
  const slide = slides[current];

  return createElement(
    'div',
    { 'data-artifact-viewer': 'pptx', 'data-slide-count': total },
    createElement(
      'div',
      { className: 'slide-deck' },
      slide
        ? createElement(
            'div',
            {
              className: 'slide',
              'data-slide-index': current,
              key: current,
            },
            createElement('h2', { className: 'slide-title' }, slide.title),
            slide.bodyText
              ? createElement('p', { className: 'slide-body' }, slide.bodyText)
              : null,
          )
        : null,
    ),
    createElement(
      'nav',
      { className: 'slide-nav' },
      createElement(
        'button',
        {
          className: 'slide-prev',
          disabled: current === 0,
          onClick: () => setCurrent((c) => Math.max(0, c - 1)),
        },
        'Prev',
      ),
      createElement('span', { className: 'slide-counter' }, `${current + 1} of ${total}`),
      createElement(
        'button',
        {
          className: 'slide-next',
          disabled: current >= total - 1,
          onClick: () => setCurrent((c) => Math.min(total - 1, c + 1)),
        },
        'Next',
      ),
    ),
  );
}

export class PptxAdapter implements ArtifactAdapter {
  readonly kind = 'pptx';

  canRender(mime: string): boolean {
    return mime === PPTX_MIME || mime === PPTX_EXT_MIME;
  }

  render(uri: string, opts: ViewOpts): ReactNode {
    // Synchronous render — callers may inject pre-parsed slides via __slides
    // override on opts (used in tests and Suspense-based wrappers).
    const optsAny = opts as ViewOpts & { __slides?: SlideData[] };
    const slides: SlideData[] = optsAny.__slides ?? [];

    return createElement(
      'div',
      { style: containerStyle(opts.theme) },
      createElement(SlideCarousel, { slides }),
    );
  }

  /** Async slide parser — call before render() for real usage. */
  async parseSlides(uri: string): Promise<SlideData[]> {
    const bytes = await loadBytes(uri);
    return parsePptx(bytes);
  }

  async export(uri: string, target: PptxExportTarget | string): Promise<Blob> {
    if (target !== 'pdf' && target !== 'png-slides') {
      throw new UnsupportedPptxExportTarget(target);
    }

    const ipcChannel = `artifact:pptx:export-${target}`;

    // Duck-typed IPC check for Electron renderer context.
    const ipc = (
      typeof window !== 'undefined'
        ? (window as unknown as Record<string, unknown>)['ipcRenderer']
        : undefined
    ) as { invoke?: (channel: string, uri: string) => Promise<ArrayBuffer> } | undefined;

    if (ipc?.invoke) {
      const buffer = await ipc.invoke(ipcChannel, uri);
      const mimeType = target === 'pdf' ? 'application/pdf' : 'image/png';
      return new Blob([buffer], { type: mimeType });
    }

    // Stub for non-Electron environments (unit tests, web preview).
    const mimeType = target === 'pdf' ? 'application/pdf' : 'image/png';
    const stub = target === 'pdf' ? '%PDF-1.4\n% pptx export stub\n' : '\x89PNG\r\n';
    return new Blob([stub], { type: mimeType });
  }
}
