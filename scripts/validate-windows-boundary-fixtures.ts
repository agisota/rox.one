#!/usr/bin/env bun
/**
 * M.18 T252 — fixture suite runner for the Windows private-release
 * boundary.
 *
 * Runs `scripts/validate-windows-private-release-boundary.ts` twice:
 *   - against `scripts/__fixtures__/windows-bundle/good-bundle`: expect exit 0
 *   - against `scripts/__fixtures__/windows-bundle/bad-bundle`:  expect exit !=0
 *     and that the error mentions the canonical AppUserModelID violation.
 *
 * No real bundles, no signtool, no Windows code-signing credentials.
 * Pure fixture-mode static assertions, so this runs identically on
 * linux CI, win32 CI, and developer laptops.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const validator = path.join(root, 'scripts/validate-windows-private-release-boundary.ts');
const fixturesRoot = path.join(root, 'scripts/__fixtures__/windows-bundle');

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
  console.error(`[windows-boundary-fixtures] ${message}`);
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
    // WINDOWS_APP_ID_PATTERN is the first check that runs against the
    // parsed app-info.txt, so the bad fixture
    // (AppUserModelID=com.notrox.fake) trips here first.
    expectMessage: 'AppUserModelID',
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
    console.log(`[windows-boundary-fixtures] ok: ${testCase.name} passed validator`);
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
      `[windows-boundary-fixtures] ok: ${testCase.name} failed validator as expected (exit=${result.status})`,
    );
  }
}

console.log('[windows-boundary-fixtures] ok: good fixture green, bad fixture red');
