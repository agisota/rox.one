#!/usr/bin/env bun
/**
 * M.18 T251 — fixture suite runner for the Mac private-release boundary.
 *
 * Runs `scripts/validate-mac-private-release-boundary.ts` twice:
 *   - against `scripts/__fixtures__/mac-bundle/good-bundle`: expect exit 0
 *   - against `scripts/__fixtures__/mac-bundle/bad-bundle`:  expect exit !=0
 *     and that the error mentions the canonical bundle-id violation.
 *
 * No real bundles are touched. No Apple credentials are involved. Pure
 * fixture-mode static assertions, so this script runs identically on linux
 * CI, darwin CI, and developer laptops.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const validator = path.join(root, 'scripts/validate-mac-private-release-boundary.ts');
const fixturesRoot = path.join(root, 'scripts/__fixtures__/mac-bundle');

interface FixtureCase {
  name: string;
  fixturePath: string;
  expectExit: 'zero' | 'nonzero';
  /** Optional substring that must appear in stderr/stdout when failure expected. */
  expectMessage?: string;
}

function runValidator(fixturePath: string) {
  return spawnSync(
    'bun',
    ['run', validator, '--fixture', fixturePath],
    { cwd: root, encoding: 'utf8' },
  );
}

function fail(message: string): never {
  console.error(`[mac-boundary-fixtures] ${message}`);
  process.exit(1);
}

const cases: FixtureCase[] = [
  {
    name: 'good-bundle',
    fixturePath: path.join(fixturesRoot, 'good-bundle'),
    expectExit: 'zero',
  },
  {
    name: 'bad-bundle',
    fixturePath: path.join(fixturesRoot, 'bad-bundle'),
    expectExit: 'nonzero',
    // BUNDLE_ID_PATTERN is the first check that runs against the parsed
    // Info.plist, so the bad fixture (CFBundleIdentifier=com.notrox.fake)
    // trips here first. The exact phrasing comes from the validator's
    // `fail("CFBundleIdentifier ... does not match ...")` call.
    expectMessage: 'CFBundleIdentifier',
  },
];

for (const testCase of cases) {
  const result = runValidator(testCase.fixturePath);
  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (testCase.expectExit === 'zero') {
    if (result.status !== 0) {
      console.error(combined);
      fail(`fixture "${testCase.name}" expected to pass but exited ${result.status}`);
    }
    console.log(`[mac-boundary-fixtures] ok: ${testCase.name} passed validator`);
  } else {
    if (result.status === 0) {
      console.error(combined);
      fail(`fixture "${testCase.name}" expected to fail but exited 0`);
    }
    if (testCase.expectMessage && !combined.includes(testCase.expectMessage)) {
      console.error(combined);
      fail(
        `fixture "${testCase.name}" failed but stderr did not contain expected marker "${testCase.expectMessage}"`,
      );
    }
    console.log(
      `[mac-boundary-fixtures] ok: ${testCase.name} failed validator as expected (exit=${result.status})`,
    );
  }
}

console.log('[mac-boundary-fixtures] ok: good fixture green, bad fixture red');
