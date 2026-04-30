import { writeFile } from 'fs/promises';

export interface OfficeDocumentConversionResult {
  textContent?: string | null;
}

export interface OfficeDocumentConverter {
  convert(sourcePath: string): Promise<OfficeDocumentConversionResult> | OfficeDocumentConversionResult;
}

export interface OfficeDocumentAdapterLogger {
  info(message: string): void;
  error(message: string): void;
}

export interface ConvertOfficeDocumentToMarkdownInput {
  sourcePath: string;
  outputPath: string;
  attachmentName: string;
  converter: OfficeDocumentConverter;
  writeTextFile?: (path: string, content: string, encoding: BufferEncoding) => Promise<void>;
  logger?: OfficeDocumentAdapterLogger;
}

export interface ConvertOfficeDocumentToMarkdownResult {
  markdownPath: string;
  textLength: number;
}

export async function convertOfficeDocumentToMarkdown(
  input: ConvertOfficeDocumentToMarkdownInput,
): Promise<ConvertOfficeDocumentToMarkdownResult> {
  const writeTextFile = input.writeTextFile ?? writeFile;

  try {
    const result = await input.converter.convert(input.sourcePath);
    const textContent = result.textContent ?? '';

    if (!textContent.trim()) {
      throw new Error('Conversion returned empty result');
    }

    await writeTextFile(input.outputPath, textContent, 'utf-8');
    input.logger?.info(`Converted Office file to markdown: ${input.outputPath}`);

    return {
      markdownPath: input.outputPath,
      textLength: textContent.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    input.logger?.error(`Office to markdown conversion failed: ${errorMessage}`);
    throw new Error(`Failed to convert "${input.attachmentName}" to readable format: ${errorMessage}`);
  }
}
