/**
 * M.18 T252 — bun:test coverage for the fixture-mode Windows
 * trust-boundary validator. We invoke
 * `scripts/validate-windows-private-release-boundary.ts` with
 * `--fixture <path>` against both the good and bad bundle fixtures
 * and assert exit-code + failure-marker semantics.
 *
 * No signtool, no Authenticode credentials, no live Windows artifacts.
 * Pure fixture-mode static assertions so this test runs identically on
 * linux CI, win32 CI, and developer laptops.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const repoRoot = join(import.meta.dir, '..', '..');
const validatorPath = join(repoRoot, 'scripts/validate-windows-private-release-boundary.ts');
const fixturesRoot = join(repoRoot, 'scripts/__fixtures__/windows-bundle');
const goodFixture = join(fixturesRoot, 'good-bundle');
const badFixture = join(fixturesRoot, 'bad-bundle');
const runnerScript = join(repoRoot, 'scripts/validate-windows-boundary-fixtures.ts');
const afterPackScript = join(repoRoot, 'apps/electron/scripts/afterPack-windows.cjs');

function runValidator(fixturePath: string) {
  return spawnSync(
    'bun',
    ['run', validatorPath, '--fixture', fixturePath],
    { cwd: repoRoot, encoding: 'utf8' },
  );
}

describe('validate-windows-boundary-fixtures contract (M.18 T252)', () => {
  test('good-bundle fixture directory tree is present on disk', () => {
    expect(existsSync(goodFixture)).toBe(true);
    expect(existsSync(join(goodFixture, 'app-info.txt'))).toBe(true);
    expect(existsSync(join(goodFixture, 'signing-output.txt'))).toBe(true);
    expect(existsSync(join(goodFixture, 'ROX.ONE.exe'))).toBe(true);
    expect(existsSync(join(goodFixture, 'chrome_elf.dll'))).toBe(true);
    expect(existsSync(join(goodFixture, 'ffmpeg.dll'))).toBe(true);
  });

  test('bad-bundle fixture directory tree is present on disk', () => {
    expect(existsSync(badFixture)).toBe(true);
    expect(existsSync(join(badFixture, 'app-info.txt'))).toBe(true);
    expect(existsSync(join(badFixture, 'signing-output.txt'))).toBe(true);
    expect(existsSync(join(badFixture, 'Fake.exe'))).toBe(true);
  });

  test('good fixture passes the validator (exit 0, success markers present)', () => {
    const result = runValidator(goodFixture);
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('fixture-mode ok');
    expect(combined).toContain('good-bundle');
  });

  test('bad fixture fails the validator on the canonical AppUserModelID check', () => {
    const result = runValidator(badFixture);
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    // Exit must be non-zero because the validator detected a violation.
    expect(result.status).not.toBe(0);
    // The first violation hits the WINDOWS_APP_ID_PATTERN check on the
    // parsed AppUserModelID; the bad fixture ships `com.notrox.fake`
    // which fails ^(one\.rox\.workbench|com\.rox\.one)(\..+)?$.
    expect(combined).toContain('AppUserModelID');
    expect(combined).toContain('com.notrox.fake');
    expect(combined).toContain('does not match');
  });

  test('bad fixture signing-output sidecar contains the forbidden tokens (defensive)', async () => {
    const text = await Bun.file(join(badFixture, 'signing-output.txt')).text();
    // Validator exits before the signing-output assert (the appId check
    // trips first), but the fixture content itself still needs to
    // include the forbidden tokens so later validator passes catch them.
    expect(text).toContain('SignTool Error');
    expect(text).toContain('No signature found');
    expect(text).toContain('is not signed');
  });

  test('good fixture signing-output sidecar contains the required canonical tokens', async () => {
    const text = await Bun.file(join(goodFixture, 'signing-output.txt')).text();
    expect(text).toContain('Subject:');
    expect(text).toContain('Issuer:');
    expect(text).toContain('SHA1 hash:');
    expect(text).toContain('(T252 windows boundary ok)');
    expect(text).not.toContain('SignTool Error');
    expect(text).not.toContain('No signature found');
    // Native binaries listed.
    expect(text).toContain('ROX.ONE.exe');
    expect(text).toContain('chrome_elf.dll');
    expect(text).toContain('ffmpeg.dll');
  });

  test('package.json wires the validate:windows-boundary-fixtures script', async () => {
    const pkg = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text());
    expect(pkg.scripts?.['validate:windows-boundary-fixtures']).toBe(
      'bun run scripts/validate-windows-boundary-fixtures.ts',
    );
    expect(pkg.scripts?.['validate:windows-private-release-boundary']).toBe(
      'bun run scripts/validate-windows-private-release-boundary.ts',
    );
  });

  test('orchestrator runner script and Windows afterPack hook exist on disk', () => {
    expect(existsSync(runnerScript)).toBe(true);
    expect(existsSync(afterPackScript)).toBe(true);
  });
});
