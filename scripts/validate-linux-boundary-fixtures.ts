#!/usr/bin/env bun
/**
 * M.18 T253 — fixture suite runner for the Linux private-release
 * boundary.
 *
 * Runs `scripts/validate-linux-private-release-boundary.ts` twice:
 *   - against `scripts/__fixtures__/linux-bundle/good-AppDir`: expect exit 0
 *   - against `scripts/__fixtures__/linux-bundle/bad-AppDir`:  expect exit !=0
 *     and that the error mentions the canonical AppImage filename
 *     violation (the bad fixture's `not-rox-one.AppImage` stub trips
 *     the canonical pattern check before any other gate runs).
 *
 * No real bundles, no gpg, no Linux signing credentials. Pure
 * fixture-mode static assertions, so this runs identically on linux,
 * darwin, and win32 CI runners.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const validator = path.join(root, 'scripts/validate-linux-private-release-boundary.ts');
const fixturesRoot = path.join(root, 'scripts/__fixtures__/linux-bundle');

interface FixtureCase {
  name: string;
  fixturePath: string;
  expectExit: 'zero' | 'nonzero';
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
  console.error(`[linux-boundary-fixtures] ${message}`);
  process.exit(1);
}

const cases: FixtureCase[] = [
  {
    name: 'good-AppDir',
    fixturePath: path.join(fixturesRoot, 'good-AppDir'),
    expectExit: 'zero',
  },
  {
    name: 'bad-AppDir',
    fixturePath: path.join(fixturesRoot, 'bad-AppDir'),
    expectExit: 'nonzero',
    // APPIMAGE_FILENAME_PATTERN is the first canonical check inside
    // assertLinuxBundleContract, so the bad fixture
    // (not-rox-one.AppImage stub) trips here first.
    expectMessage: 'AppImage filename',
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
    console.log(`[linux-boundary-fixtures] ok: ${testCase.name} passed validator`);
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
      `[linux-boundary-fixtures] ok: ${testCase.name} failed validator as expected (exit=${result.status})`,
    );
  }
}

console.log('[linux-boundary-fixtures] ok: good fixture green, bad fixture red');
