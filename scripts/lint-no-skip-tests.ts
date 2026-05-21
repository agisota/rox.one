#!/usr/bin/env bun
//
// Lint guard: no skipped/focused tests in main-branch source.
//
// CLAUDE.md (User Engineering Rules → git_and_versioning) bans
// `it.skip`, `xit`, `.only`, `test.skip`, `describe.skip` in the main
// branch. This script enforces that contract.
//
// Allowed exceptions:
//   - it.skipIf(...) / test.skipIf(...) — env/OS-gated conditional skip is
//     fine because the test still runs whenever the gate is open.
//
// Output format mirrors the workflow-pin lint: one ::error file=...,line=...::
// annotation per violation so PR diffs surface the issue inline.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_ROOTS = ['packages', 'apps'];
const TEST_FILE_PATTERN = /\.test\.tsx?$/;
const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.vite',
  '.cache',
  'coverage',
  '__fixtures__',
]);

// Each regex is paired with a human-readable label for diagnostics.
// We deliberately allow `\.skipIf\(` by NOT matching it: the patterns below
// require `(` immediately after the keyword (no `If` in between).
const FORBIDDEN_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'it.skip(', pattern: /\bit\.skip\(/ },
  { label: 'test.skip(', pattern: /\btest\.skip\(/ },
  { label: 'describe.skip(', pattern: /\bdescribe\.skip\(/ },
  { label: 'xit(', pattern: /\bxit\(/ },
  { label: 'xdescribe(', pattern: /\bxdescribe\(/ },
  { label: 'it.only(', pattern: /\bit\.only\(/ },
  { label: 'test.only(', pattern: /\btest\.only\(/ },
  { label: 'describe.only(', pattern: /\bdescribe\.only\(/ },
];

type Violation = { file: string; line: number; label: string; raw: string };

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIR_NAMES.has(entry)) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (TEST_FILE_PATTERN.test(entry)) {
      out.push(full);
    }
  }
}

function scanFile(file: string): Violation[] {
  const text = readFileSync(file, 'utf8');
  const violations: Violation[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip line comments — a comment that mentions `.only(` is documentation,
    // not an actual focused test. Block comments are rare in test files and
    // a false positive there is acceptable.
    const codePart = line.replace(/\/\/.*$/, '');
    for (const { label, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(codePart)) {
        violations.push({ file, line: i + 1, label, raw: line.trim() });
      }
    }
  }
  return violations;
}

function main(): void {
  const files: string[] = [];
  for (const sub of SCAN_ROOTS) {
    walk(join(ROOT, sub), files);
  }

  if (files.length === 0) {
    console.warn(`[no-skip-tests] no test files found under ${SCAN_ROOTS.join(', ')}`);
    return;
  }

  const violations: Violation[] = [];
  for (const file of files) {
    violations.push(...scanFile(file));
  }

  if (violations.length === 0) {
    console.log(`[no-skip-tests] OK — scanned ${files.length} test file(s), no forbidden skips.`);
    return;
  }

  console.error(
    `[no-skip-tests] FAIL — ${violations.length} forbidden skip/only pattern(s) in ${files.length} test file(s):`,
  );
  for (const v of violations) {
    const rel = relative(ROOT, v.file);
    console.error(
      `::error file=${rel},line=${v.line}::Forbidden ${v.label} in main branch. Un-skip + fix, delete the test, or convert to .skipIf(env-gate).`,
    );
    console.error(`  ${rel}:${v.line}  ${v.raw}`);
  }
  console.error(
    '\nWhy: .skip/.only/xit leak across commits and disable coverage silently. Allowed alternative: .skipIf(<condition>) for env/OS-gated cases.',
  );
  process.exit(1);
}

main();
