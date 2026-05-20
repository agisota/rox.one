/**
 * XLSX artifact viewer adapter.
 *
 * Renders the first sheet of an XLSX workbook as a plain HTML <table>
 * using ROX theme CSS variables. Maximum visible area is capped at
 * 1000 rows × 100 columns to keep the DOM bounded.
 *
 * Sandboxing: renderer-only (no Electron partition needed) — exceljs
 * operates on an ArrayBuffer and never loads remote resources.
 *
 * Security note: all cell values are passed through escapeHtml() before
 * being embedded in the table markup, so dangerouslySetInnerHTML is safe
 * by construction — no raw workbook content reaches the DOM unescaped.
 */
import { createElement } from 'react';
import type { ReactNode } from 'react';
import ExcelJS from 'exceljs';
import type { ArtifactAdapter, ViewOpts, ExportTarget } from '@rox-one/artifact-viewer-core/types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Maximum rows and columns rendered into the DOM. */
const MAX_ROWS = 1000;
const MAX_COLS = 100;

/**
 * Resolve an ArrayBuffer from a data: or file: URI.
 * In tests, callers pass a data: URI with base64-encoded workbook bytes.
 */
async function loadBuffer(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    const payload = uri.slice(commaIdx + 1);
    if (uri.slice(0, commaIdx).includes(';base64')) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(payload)).buffer;
  }
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/** Load workbook from URI, returning the ExcelJS Workbook. */
async function loadWorkbook(uri: string): Promise<ExcelJS.Workbook> {
  const buffer = await loadBuffer(uri);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

/**
 * Render a worksheet into an HTML <table> string.
 * All cell values are HTML-escaped via escapeHtml() — safe for innerHTML.
 * Caps at MAX_ROWS rows and MAX_COLS columns.
 */
function worksheetToTableHtml(sheet: ExcelJS.Worksheet): { html: string; truncated: boolean } {
  const rows: string[][] = [];
  let truncated = false;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS) {
      truncated = true;
      return;
    }
    const cells: string[] = [];
    const colCount = Math.min(row.cellCount, MAX_COLS);
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cells.push(String(cell.value ?? ''));
    }
    rows.push(cells);
  });

  const firstRow = rows[0] ?? [];
  const thead =
    firstRow.length > 0
      ? `<thead><tr>${firstRow.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
      : '';

  const tbody = rows
    .slice(1)
    .map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`)
    .join('');

  const html = `<table style="border-collapse:collapse;width:100%">${thead}<tbody>${tbody}</tbody></table>`;
  return { html, truncated };
}

/** HTML-escape a string — prevents XSS when injecting cell values into markup. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** CSS for the outer container using ROX theme CSS vars. */
function containerStyle(): React.CSSProperties {
  return {
    background: 'var(--rox-bg)',
    color: 'var(--rox-fg)',
    border: '1px solid var(--rox-border)',
    overflow: 'auto',
    height: '100%',
    boxSizing: 'border-box',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.875rem',
  };
}

export class XlsxAdapter implements ArtifactAdapter {
  readonly kind = 'xlsx';

  canRender(mime: string): boolean {
    return mime === XLSX_MIME || mime.endsWith('.xlsx');
  }

  render(uri: string, opts: ViewOpts): ReactNode {
    // Synchronous render returns a placeholder div. The actual async render
    // is performed by renderAsync(), called by the Suspense-aware panel wrapper
    // in production and directly by tests.
    void opts;
    return createElement('div', {
      'data-artifact-viewer': 'xlsx',
      'data-uri': uri,
      style: containerStyle(),
    });
  }

  /**
   * Async render — loads the workbook and returns a fully populated React element.
   * Called directly by tests and by the async panel wrapper in production.
   */
  async renderAsync(uri: string, _opts: ViewOpts): Promise<ReactNode> {
    const wb = await loadWorkbook(uri);
    const sheet = wb.worksheets[0];
    if (!sheet) {
      return createElement('div', { 'data-artifact-viewer': 'xlsx' }, 'No sheets found.');
    }
    const { html, truncated } = worksheetToTableHtml(sheet);
    const children: ReactNode[] = [];
    if (truncated) {
      children.push(
        createElement('div', {
          key: 'truncation-notice',
          style: { padding: '0.25rem 0.5rem', background: 'var(--rox-border)', fontSize: '0.75rem' },
        }, `Preview truncated to ${MAX_ROWS} rows × ${MAX_COLS} columns.`),
      );
    }
    // Safe: html is built entirely from escapeHtml()-sanitized cell values.
    children.push(
      createElement('div', {
        key: 'table',
        dangerouslySetInnerHTML: { __html: html },
      }),
    );
    return createElement('div', {
      'data-artifact-viewer': 'xlsx',
      style: containerStyle(),
    }, ...children);
  }

  /**
   * Export the first sheet to a Blob.
   * Supports 'html' (text/html) from ExportTarget, plus 'csv' (text/csv) as
   * an xlsx-specific extension.  All other ExportTarget values ('pdf', 'png',
   * 'native') throw UnsupportedExportTargetError.
   */
  async export(uri: string, target: ExportTarget | 'csv'): Promise<Blob> {
    const wb = await loadWorkbook(uri);
    const sheet = wb.worksheets[0];

    if (target === 'csv') {
      const csv = sheet ? sheetToCsv(sheet) : '';
      return new Blob([csv], { type: 'text/csv' });
    }

    if (target === 'html') {
      const { html } = sheet ? worksheetToTableHtml(sheet) : { html: '' };
      const full = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head><meta charset="utf-8"><title>Artifact Export</title>',
        '<style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>',
        '</head>',
        '<body>',
        html,
        '</body>',
        '</html>',
      ].join('\n');
      return new Blob([full], { type: 'text/html' });
    }

    throw new UnsupportedExportTargetError(target);
  }
}

/** RFC 4180 CSV serialisation of the first MAX_ROWS × MAX_COLS of a sheet. */
function sheetToCsv(sheet: ExcelJS.Worksheet): string {
  const lines: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS) return;
    const colCount = Math.min(row.cellCount, MAX_COLS);
    const fields: string[] = [];
    for (let c = 1; c <= colCount; c++) {
      const val = String(row.getCell(c).value ?? '');
      // RFC 4180: quote fields containing comma, double-quote, or newline
      if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
        fields.push(`"${val.replace(/"/g, '""')}"`);
      } else {
        fields.push(val);
      }
    }
    lines.push(fields.join(','));
  });
  return lines.join('\r\n');
}

/** Thrown when export() is called with an unsupported target format. */
export class UnsupportedExportTargetError extends Error {
  readonly target: string;
  constructor(target: string) {
    super(`XlsxAdapter: unsupported export target "${target}"`);
    this.name = 'UnsupportedExportTargetError';
    this.target = target;
  }
}

export type { ExportTarget };
