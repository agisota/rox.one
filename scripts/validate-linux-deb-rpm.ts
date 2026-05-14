#!/usr/bin/env bun
/**
 * Linux .deb + .rpm package mirror validator (M.18 T253b).
 *
 * Asserts that `apps/electron/electron-builder.yml` declares both `deb` and
 * `rpm` as Linux targets in addition to the existing AppImage, and that the
 * shared Linux block carries the required metadata fields:
 *   - category: non-empty (canonical "Office")
 *   - synopsis: non-empty
 *   - maintainer: non-empty
 *
 * Also asserts that top-level `deb:` and `rpm:` config blocks exist so
 * per-format settings (depends, packageCategory) are explicit.
 *
 * Cross-platform: runs on linux, darwin, win32. No build output required;
 * all assertions are pure text/shape checks on tracked config files.
 *
 * Usage:
 *   bun run scripts/validate-linux-deb-rpm.ts
 *   bun run scripts/validate-linux-deb-rpm.ts --config <path-to-yml>
 *
 * Exit codes:
 *   0 — all assertions pass
 *   1 — at least one assertion failed (error message printed to stderr)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// ---------------------------------------------------------------------------
// CLI: allow overriding config path for fixture-mode testing
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
let configRelPath = 'apps/electron/electron-builder.yml';
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--config') {
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      console.error('[linux-deb-rpm] --config requires a path argument');
      process.exit(1);
    }
    configRelPath = next;
    i++;
  } else if (arg.startsWith('--config=')) {
    configRelPath = arg.slice('--config='.length);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(message: string): never {
  console.error(`[linux-deb-rpm] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  const absPath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(root, relativePath);
  try {
    return readFileSync(absPath, 'utf8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    fail(`cannot read ${absPath}: ${message}`);
  }
}

function requireText(source: string, needle: string, description: string): void {
  if (!source.includes(needle)) {
    fail(`missing ${description}: expected to find "${needle}"`);
  }
}

// ---------------------------------------------------------------------------
// 1. Read electron-builder config
// ---------------------------------------------------------------------------

const config = read(configRelPath);

// ---------------------------------------------------------------------------
// 2. linux: block must exist with required metadata fields
// ---------------------------------------------------------------------------

requireText(config, 'linux:', 'linux: build block');
requireText(config, 'category: Office', 'linux category pin (Office)');
requireText(config, 'synopsis:', 'linux synopsis field');
requireText(config, 'maintainer:', 'linux maintainer field');

// Verify synopsis is not blank (next non-whitespace value after the key).
const synopsisMatch = /synopsis:\s*["']?(.+?)["']?\s*[\r\n]/.exec(config);
if (!synopsisMatch || synopsisMatch[1].trim().length === 0) {
  fail('linux synopsis value is empty or missing');
}

// Verify maintainer is not blank.
const maintainerMatch = /maintainer:\s*["']?(.+?)["']?\s*[\r\n]/.exec(config);
if (!maintainerMatch || maintainerMatch[1].trim().length === 0) {
  fail('linux maintainer value is empty or missing');
}

// ---------------------------------------------------------------------------
// 3. Both deb and rpm must be listed in the linux target array
// ---------------------------------------------------------------------------

// Extract the linux: block (everything up to the next top-level key).
const linuxBlockStart = config.indexOf('\nlinux:');
if (linuxBlockStart === -1) {
  fail('linux: block not found in electron-builder config');
}

const afterLinux = config.slice(linuxBlockStart + 1);
const nextTopKeyMatch = /\n(?=[a-zA-Z])/.exec(afterLinux);
const linuxBlock = nextTopKeyMatch
  ? afterLinux.slice(0, nextTopKeyMatch.index)
  : afterLinux;

if (!/target:\s*deb/.test(linuxBlock) && !/- target: deb/.test(linuxBlock)) {
  fail('deb is not listed in linux.target — add "- target: deb" to the linux: targets array');
}

if (!/target:\s*rpm/.test(linuxBlock) && !/- target: rpm/.test(linuxBlock)) {
  fail('rpm is not listed in linux.target — add "- target: rpm" to the linux: targets array');
}

// AppImage must still be present (regression guard for T253).
if (!/target:\s*AppImage/.test(linuxBlock) && !/- target: AppImage/.test(linuxBlock)) {
  fail('AppImage is no longer listed in linux.target — T253 regression detected');
}

// ---------------------------------------------------------------------------
// 4. Top-level deb: and rpm: config blocks must exist
// ---------------------------------------------------------------------------

if (!/^deb:/m.test(config)) {
  fail('top-level deb: config block missing — add per-format .deb settings');
}

if (!/^rpm:/m.test(config)) {
  fail('top-level rpm: config block missing — add per-format .rpm settings');
}

// deb: block must declare system depends
requireText(config, 'libnss3', 'deb depends: libnss3');
requireText(config, 'libnotify', 'deb/rpm depends: libnotify');

// ---------------------------------------------------------------------------
// 5. package.json: validate:linux-deb-rpm script must be wired
// ---------------------------------------------------------------------------

const packageJson = JSON.parse(read('package.json')) as {
  scripts?: Record<string, string>;
};
const scripts = packageJson.scripts ?? {};
const scriptEntry = scripts['validate:linux-deb-rpm'];
if (typeof scriptEntry !== 'string' || !scriptEntry.includes('validate-linux-deb-rpm.ts')) {
  fail(
    'package.json missing validate:linux-deb-rpm script — add ' +
    '"validate:linux-deb-rpm": "bun run scripts/validate-linux-deb-rpm.ts"',
  );
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log('[linux-deb-rpm] ok: deb + rpm targets present alongside AppImage');
console.log('[linux-deb-rpm] ok: category, synopsis, maintainer non-empty');
console.log('[linux-deb-rpm] ok: top-level deb: and rpm: config blocks present');
console.log('[linux-deb-rpm] ok: package.json validate:linux-deb-rpm script wired');
