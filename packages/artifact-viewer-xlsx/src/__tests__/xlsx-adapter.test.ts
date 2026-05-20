import { describe, it, expect, beforeAll } from 'bun:test';
import ExcelJS from 'exceljs';
import { XlsxAdapter, UnsupportedExportTargetError } from '../xlsx-adapter.ts';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const defaultOpts = {
  theme: 'light' as const,
  size: { width: 800, height: 600 },
  signal: new AbortController().signal,
  partition: '',
  locale: 'en',
};

/** Build an XLSX buffer with the given rows and return a data: URI. */
async function makeXlsxDataUri(rows: string[][]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  return `data:${XLSX_MIME};base64,${base64}`;
}

describe('XlsxAdapter', () => {
  const adapter = new XlsxAdapter();

  // ── 1. canRender ──────────────────────────────────────────────────────────

  it('canRender returns true for XLSX MIME type', () => {
    expect(adapter.canRender(XLSX_MIME)).toBe(true);
  });

  it('canRender returns true for strings ending in .xlsx', () => {
    expect(adapter.canRender('application/octet-stream; filename=report.xlsx')).toBe(true);
  });

  it('canRender returns false for non-xlsx MIME', () => {
    expect(adapter.canRender('text/csv')).toBe(false);
    expect(adapter.canRender('application/pdf')).toBe(false);
    expect(adapter.canRender('text/html')).toBe(false);
  });

  // ── 2. render produces a table with N rows ─────────────────────────────────

  it('renderAsync produces a React element containing a <table> with the correct rows', async () => {
    const rows = [['Name', 'Score'], ['Alice', '95'], ['Bob', '87']];
    const uri = await makeXlsxDataUri(rows);
    const { renderToStaticMarkup } = await import('react-dom/server');
    const node = await adapter.renderAsync(uri, defaultOpts);
    const html = renderToStaticMarkup(node as Parameters<typeof renderToStaticMarkup>[0]);
    expect(html).toContain('<table');
    expect(html).toContain('Alice');
    expect(html).toContain('Score');
    expect(html).toContain('87');
  });

  // ── 3. render truncates beyond 1000 rows ──────────────────────────────────

  it('renderAsync truncates rows beyond 1000 and shows a truncation notice', async () => {
    // Build a workbook with 1002 rows (header + 1001 data rows)
    const rows: string[][] = [['Index']];
    for (let i = 1; i <= 1001; i++) {
      rows.push([String(i)]);
    }
    const uri = await makeXlsxDataUri(rows);
    const { renderToStaticMarkup } = await import('react-dom/server');
    const node = await adapter.renderAsync(uri, defaultOpts);
    const html = renderToStaticMarkup(node as Parameters<typeof renderToStaticMarkup>[0]);
    // Row 1001 should be absent (truncated)
    expect(html).toContain('truncated');
    expect(html).not.toContain('>1001<');
  });

  // ── 4. export csv produces RFC 4180 CSV ───────────────────────────────────

  it('export csv produces RFC 4180 CSV with CRLF line endings', async () => {
    const rows = [['City', 'Pop'], ['New York', '8000000'], ['LA', '4000000']];
    const uri = await makeXlsxDataUri(rows);
    const blob = await adapter.export(uri, 'csv');
    const csv = await blob.text();
    expect(csv).toContain('City,Pop\r\n');
    expect(csv).toContain('New York,8000000');
    expect(csv).toContain('LA,4000000');
  });

  it('export csv quotes fields containing commas per RFC 4180', async () => {
    const rows = [['Description', 'Value'], ['Hello, world', '42']];
    const uri = await makeXlsxDataUri(rows);
    const blob = await adapter.export(uri, 'csv');
    const csv = await blob.text();
    expect(csv).toContain('"Hello, world"');
  });

  // ── 5. export html ────────────────────────────────────────────────────────

  it('export html returns a full HTML document containing the table', async () => {
    const rows = [['Product', 'Price'], ['Widget', '9.99']];
    const uri = await makeXlsxDataUri(rows);
    const blob = await adapter.export(uri, 'html');
    const html = await blob.text();
    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('<table');
    expect(html).toContain('Widget');
    expect(html).toContain('9.99');
  });

  // ── 6. unsupported target rejected ────────────────────────────────────────

  it('export throws UnsupportedExportTargetError for unsupported target "pdf"', async () => {
    const uri = await makeXlsxDataUri([['A', 'B']]);
    await expect(adapter.export(uri, 'pdf')).rejects.toBeInstanceOf(UnsupportedExportTargetError);
  });
});
