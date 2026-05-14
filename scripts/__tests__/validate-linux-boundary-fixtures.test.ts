/**
 * M.18 T253 — bun:test coverage for the fixture-mode Linux
 * trust-boundary validator. We invoke
 * `scripts/validate-linux-private-release-boundary.ts` with
 * `--fixture <path>` against both the good and bad AppDir fixtures
 * and assert exit-code + failure-marker semantics.
 *
 * No gpg, no AppImage signing credentials, no live Linux artifacts.
 * Pure fixture-mode static assertions so this test runs identically
 * on linux CI, darwin CI, and win32 CI runners.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const repoRoot = join(import.meta.dir, '..', '..');
const validatorPath = join(repoRoot, 'scripts/validate-linux-private-release-boundary.ts');
const fixturesRoot = join(repoRoot, 'scripts/__fixtures__/linux-bundle');
const goodFixture = join(fixturesRoot, 'good-AppDir');
const badFixture = join(fixturesRoot, 'bad-AppDir');
const runnerScript = join(repoRoot, 'scripts/validate-linux-boundary-fixtures.ts');
const afterPackScript = join(repoRoot, 'apps/electron/scripts/afterPack-linux.cjs');

function runValidator(fixturePath: string) {
  return spawnSync(
    'bun',
    ['run', validatorPath, '--fixture', fixturePath],
    { cwd: repoRoot, encoding: 'utf8' },
  );
}

describe('validate-linux-boundary-fixtures contract (M.18 T253)', () => {
  test('good-AppDir fixture directory tree is present on disk', () => {
    expect(existsSync(goodFixture)).toBe(true);
    expect(existsSync(join(goodFixture, 'rox-one.desktop'))).toBe(true);
    expect(existsSync(join(goodFixture, 'signing-output.txt'))).toBe(true);
    expect(existsSync(join(goodFixture, 'rox-one'))).toBe(true);
    expect(existsSync(join(goodFixture, 'rox-one-1.2.3-x64.AppImage'))).toBe(true);
  });

  test('bad-AppDir fixture directory tree is present on disk', () => {
    expect(existsSync(badFixture)).toBe(true);
    expect(existsSync(join(badFixture, 'rox-one.desktop'))).toBe(true);
    expect(existsSync(join(badFixture, 'signing-output.txt'))).toBe(true);
    expect(existsSync(join(badFixture, 'not-rox-one.AppImage'))).toBe(true);
  });

  test('good fixture passes the validator (exit 0, success markers present)', () => {
    const result = runValidator(goodFixture);
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('fixture-mode ok');
    expect(combined).toContain('good-AppDir');
  });

  test('bad fixture fails the validator on the canonical AppImage filename check', () => {
    const result = runValidator(badFixture);
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    // Exit must be non-zero because the validator detected a violation.
    expect(result.status).not.toBe(0);
    // The first canonical violation hits APPIMAGE_FILENAME_PATTERN; the
    // bad fixture ships `not-rox-one.AppImage` which fails
    // ^rox-one(-[A-Za-z0-9.+-]+)*\.AppImage$.
    expect(combined).toContain('AppImage filename');
    expect(combined).toContain('not-rox-one.AppImage');
    expect(combined).toContain('does not match');
  });

  test('bad fixture signing-output sidecar contains the forbidden tokens (defensive)', async () => {
    const text = await Bun.file(join(badFixture, 'signing-output.txt')).text();
    // Validator exits before the signing-output assert (the filename
    // check trips first), but the fixture content itself still needs
    // to include the forbidden tokens so later validator passes catch
    // them.
    expect(text).toContain('BAD signature');
    expect(text).toContain('No public key');
    expect(text).toContain('is not signed');
  });

  test('good fixture signing-output sidecar contains the required canonical tokens', async () => {
    const text = await Bun.file(join(goodFixture, 'signing-output.txt')).text();
    expect(text).toContain('gpg:');
    expect(text).toContain('Good signature');
    expect(text).toContain('Primary key fingerprint');
    expect(text).toContain('(T253 linux boundary ok)');
    expect(text).not.toContain('BAD signature');
    expect(text).not.toContain('No public key');
    // Native binaries listed.
    expect(text).toContain('rox-one');
    expect(text).toContain('rox-one-1.2.3-x64.AppImage');
    expect(text).toContain('libnode.so');
  });

  test('good fixture desktop entry carries the canonical Exec=rox-one line and T253 marker', async () => {
    const text = await Bun.file(join(goodFixture, 'rox-one.desktop')).text();
    expect(text).toContain('[Desktop Entry]');
    expect(text).toContain('Name=rox-one');
    expect(text).toContain('Exec=rox-one %U');
    expect(text).toContain('Categories=Office;Utility;Development;');
    expect(text).toContain('(T253 linux boundary ok)');
    expect(text).toContain('X-RoxOne-AppId=com.rox.one');
  });

  test('package.json wires the validate:linux-* scripts', async () => {
    const pkg = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text());
    expect(pkg.scripts?.['validate:linux-boundary-fixtures']).toBe(
      'bun run scripts/validate-linux-boundary-fixtures.ts',
    );
    expect(pkg.scripts?.['validate:linux-private-release-boundary']).toBe(
      'bun run scripts/validate-linux-private-release-boundary.ts',
    );
  });

  test('orchestrator runner script and Linux afterPack hook exist on disk', () => {
    expect(existsSync(runnerScript)).toBe(true);
    expect(existsSync(afterPackScript)).toBe(true);
  });
});
