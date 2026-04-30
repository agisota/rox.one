import { describe, expect, it } from 'bun:test';
import { convertOfficeDocumentToMarkdown } from './office-document-adapter';

describe('office document adapter', () => {
  it('converts an Office document through an injected converter and writes markdown', async () => {
    const writes: Array<{ path: string; content: string; encoding: BufferEncoding }> = [];
    const infoMessages: string[] = [];

    const result = await convertOfficeDocumentToMarkdown({
      sourcePath: '/tmp/input.docx',
      outputPath: '/tmp/output.md',
      attachmentName: 'input.docx',
      converter: {
        async convert(path) {
          expect(path).toBe('/tmp/input.docx');
          return { textContent: '# Extracted\n\nHello ROX' };
        },
      },
      writeTextFile: async (path, content, encoding) => {
        writes.push({ path, content, encoding });
      },
      logger: {
        info(message) {
          infoMessages.push(message);
        },
        error() {
          throw new Error('unexpected error log');
        },
      },
    });

    expect(result).toEqual({
      markdownPath: '/tmp/output.md',
      textLength: 22,
    });
    expect(writes).toEqual([
      {
        path: '/tmp/output.md',
        content: '# Extracted\n\nHello ROX',
        encoding: 'utf-8',
      },
    ]);
    expect(infoMessages).toEqual(['Converted Office file to markdown: /tmp/output.md']);
  });

  it('rejects empty conversion output without writing markdown', async () => {
    const writes: string[] = [];

    await expect(
      convertOfficeDocumentToMarkdown({
        sourcePath: '/tmp/empty.pptx',
        outputPath: '/tmp/empty.md',
        attachmentName: 'empty.pptx',
        converter: {
          async convert() {
            return { textContent: '   \n\t' };
          },
        },
        writeTextFile: async (path) => {
          writes.push(path);
        },
      }),
    ).rejects.toThrow('Failed to convert "empty.pptx" to readable format: Conversion returned empty result');

    expect(writes).toEqual([]);
  });

  it('wraps converter failures with the attachment name and avoids leaking markdown content to logs', async () => {
    const errors: string[] = [];

    await expect(
      convertOfficeDocumentToMarkdown({
        sourcePath: '/tmp/broken.xlsx',
        outputPath: '/tmp/broken.md',
        attachmentName: 'broken.xlsx',
        converter: {
          async convert() {
            throw new Error('unsupported workbook');
          },
        },
        logger: {
          info() {
            throw new Error('unexpected info log');
          },
          error(message) {
            errors.push(message);
          },
        },
      }),
    ).rejects.toThrow('Failed to convert "broken.xlsx" to readable format: unsupported workbook');

    expect(errors).toEqual(['Office to markdown conversion failed: unsupported workbook']);
  });
});
