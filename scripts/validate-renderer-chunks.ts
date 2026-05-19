#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export type RendererChunkIssue = {
  severity: 'error';
  message: string;
};

export type RendererChunkValidationResult = {
  issues: RendererChunkIssue[];
};

type ChunkRecord = {
  name: string;
  absolutePath: string;
  content: string;
  imports: Set<string>;
};

const REACT_CHUNK_PREFIX = 'index-react-';
const I18N_CHUNK_PREFIX = 'i18n-';
const REACT_I18N_CYCLE_MESSAGE =
  'React runtime chunk and i18n chunk import each other; this is the packaged-loader crash shape.';

export function validateRendererChunks(assetsDir: string): RendererChunkValidationResult {
  const absoluteAssetsDir = path.resolve(assetsDir);
  const issues: RendererChunkIssue[] = [];

  if (!existsSync(absoluteAssetsDir)) {
    return {
      issues: [
        {
          severity: 'error',
          message: `missing renderer assets directory: ${assetsDir}`,
        },
      ],
    };
  }

  const chunks = collectChunks(absoluteAssetsDir);
  const chunksByName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const reactChunks = chunks.filter((chunk) => chunk.name.startsWith(REACT_CHUNK_PREFIX));
  const i18nChunks = chunks.filter((chunk) => chunk.name.startsWith(I18N_CHUNK_PREFIX));

  if (reactChunks.length === 0) {
    issues.push({ severity: 'error', message: 'missing index-react-* renderer chunk' });
  }

  if (i18nChunks.length === 0) {
    issues.push({ severity: 'error', message: 'missing i18n-* renderer chunk' });
  }

  if (reactChunks.length > 0 && i18nChunks.length > 0) {
    const hasReactI18nCycle = reactChunks.some((reactChunk) =>
      i18nChunks.some((i18nChunk) =>
        hasReachableImport(reactChunk.name, i18nChunk.name, chunksByName) &&
        hasReachableImport(i18nChunk.name, reactChunk.name, chunksByName),
      ),
    );

    if (hasReactI18nCycle) {
      issues.push({ severity: 'error', message: REACT_I18N_CYCLE_MESSAGE });
    }
  }

  return { issues };
}

function collectChunks(dir: string): ChunkRecord[] {
  const chunks: ChunkRecord[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chunks.push(...collectChunks(absolutePath));
      continue;
    }

    if (!entry.isFile() || path.extname(entry.name) !== '.js') {
      continue;
    }

    const content = readFileSync(absolutePath, 'utf8');
    chunks.push({
      name: path.basename(absolutePath),
      absolutePath,
      content,
      imports: extractRelativeJsImports(content),
    });
  }

  return chunks;
}

function extractRelativeJsImports(content: string): Set<string> {
  const imports = new Set<string>();
  const patterns = [
    /\bimport(?:[^'"()]*?from)?\s*["']\.\/([^"']+\.js)["']/g,
    /\bimport\(\s*["']\.\/([^"']+\.js)["']\s*\)/g,
    /\bexport(?:[^'"]*?from)\s*["']\.\/([^"']+\.js)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const importedName = match[1];
      if (importedName) {
        imports.add(path.basename(importedName));
      }
    }
  }

  return imports;
}

function hasReachableImport(
  from: string,
  target: string,
  chunksByName: Map<string, ChunkRecord>,
  visited = new Set<string>(),
): boolean {
  if (from === target) {
    return true;
  }

  if (visited.has(from)) {
    return false;
  }
  visited.add(from);

  const chunk = chunksByName.get(from);
  if (!chunk) {
    return false;
  }

  for (const imported of chunk.imports) {
    if (imported === target || hasReachableImport(imported, target, chunksByName, visited)) {
      return true;
    }
  }

  return false;
}

if (import.meta.main) {
  const assetsDir = process.argv[2] ?? 'apps/electron/dist/renderer/assets';
  const result = validateRendererChunks(assetsDir);

  if (result.issues.length > 0) {
    console.error('[renderer-chunks] validation failed:');
    for (const issue of result.issues) {
      console.error(`- ${issue.message}`);
    }
    process.exit(1);
  }

  const absoluteAssetsDir = path.resolve(assetsDir);
  const jsCount = existsSync(absoluteAssetsDir)
    ? countJavaScriptFiles(absoluteAssetsDir)
    : 0;
  console.log(`[renderer-chunks] ok: ${jsCount} JS chunks checked`);
}

function countJavaScriptFiles(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((count, entry) => {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return count + countJavaScriptFiles(absolutePath);
    if (entry.isFile() && statSync(absolutePath).isFile() && path.extname(entry.name) === '.js') return count + 1;
    return count;
  }, 0);
}
