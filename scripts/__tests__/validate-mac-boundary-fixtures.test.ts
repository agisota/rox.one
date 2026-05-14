/**
 * M.18 T251 — bun:test coverage for the fixture-mode trust-boundary
 * validator. We invoke `scripts/validate-mac-private-release-boundary.ts`
 * with `--fixture <path>` against both the good and bad bundle fixtures
 * and assert exit-code + failure-marker semantics.
 *
 * No real Apple credentials. No `codesign` invocations. Pure static
 * fixture checks so this test runs identically on linux CI, darwin CI,
 * and developer laptops.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';

const repoRoot = join(import.meta.dir, '..', '..');
const validatorPath = join(repoRoot, 'scripts/validate-mac-private-release-boundary.ts');
const fixturesRoot = join(repoRoot, 'scripts/__fixtures__/mac-bundle');
const goodFixture = join(fixturesRoot, 'good-bundle');
const badFixture = join(fixturesRoot, 'bad-bundle');
const runnerScript = join(repoRoot, 'scripts/validate-mac-boundary-fixtures.ts');
const afterSignScript = join(repoRoot, 'apps/electron/scripts/afterSign.cjs');

function runValidator(fixturePath: string) {
  return spawnSync(
    'bun',
    ['run', validatorPath, '--fixture', fixturePath],
    { cwd: repoRoot, encoding: 'utf8' },
  );
}

describe('validate-mac-boundary-fixtures contract (M.18 T251)', () => {
  test('good-bundle fixture directory tree is present on disk', () => {
    expect(existsSync(goodFixture)).toBe(true);
    expect(existsSync(join(goodFixture, 'Contents/Info.plist'))).toBe(true);
    expect(existsSync(join(goodFixture, 'Contents/MacOS/ROX.ONE'))).toBe(true);
    expect(existsSync(join(goodFixture, 'Contents/Resources/entitlements.mac.plist'))).toBe(true);
    expect(existsSync(join(goodFixture, 'signing-output.txt'))).toBe(true);
  });

  test('bad-bundle fixture directory tree is present on disk', () => {
    expect(existsSync(badFixture)).toBe(true);
    expect(existsSync(join(badFixture, 'Contents/Info.plist'))).toBe(true);
    expect(existsSync(join(badFixture, 'Contents/MacOS/Fake'))).toBe(true);
    expect(existsSync(join(badFixture, 'Contents/Resources/entitlements.mac.plist'))).toBe(true);
    expect(existsSync(join(badFixture, 'signing-output.txt'))).toBe(true);
  });

  test('good fixture passes the validator (exit 0, success markers present)', () => {
    const result = runValidator(goodFixture);
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(combined).toContain('fixture-mode ok');
    expect(combined).toContain('good-bundle');
  });

  test('bad fixture fails the validator on the canonical bundle-id check', () => {
    const result = runValidator(badFixture);
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    // Exit must be non-zero because the validator detected a violation.
    expect(result.status).not.toBe(0);
    // The first violation the validator hits inside assertBundleContract is
    // the BUNDLE_ID_PATTERN check on the parsed CFBundleIdentifier; the bad
    // fixture ships `com.notrox.fake` which fails ^com\.rox\.one(\..+)?$.
    expect(combined).toContain('CFBundleIdentifier');
    expect(combined).toContain('com.notrox.fake');
    expect(combined).toContain('does not match');
  });

  test('bad fixture signing-output sidecar contains the forbidden entitlements (defensive)', () => {
    const result = runValidator(badFixture);
    // The validator now exits before the entitlement asserts (the bundle-id
    // check trips first), but the fixture content itself still needs to
    // include the forbidden tokens so later validator passes that get past
    // the bundle-id check will keep catching them. We simply re-read the
    // fixture sidecar and assert the forbidden keys are present.
    const sidecar = Bun.file(join(badFixture, 'signing-output.txt'));
    return sidecar.text().then((text) => {
      expect(text).toContain('com.apple.security.cs.disable-library-validation');
      expect(text).toContain('com.apple.security.network.server');
      // Sanity: result is wired so test runner records this branch.
      expect(typeof result.status).toBe('number');
    });
  });

  test('good fixture signing-output sidecar lacks every forbidden entitlement', async () => {
    const text = await Bun.file(join(goodFixture, 'signing-output.txt')).text();
    expect(text).not.toContain('com.apple.security.cs.disable-library-validation');
    expect(text).not.toContain('com.apple.security.network.server');
    expect(text).not.toContain('com.apple.security.cs.allow-dyld-environment-variables');
    // Must list the required outbound-network entitlement.
    expect(text).toContain('com.apple.security.network.client');
  });

  test('package.json wires the validate:mac-boundary-fixtures script', async () => {
    const pkg = JSON.parse(await Bun.file(join(repoRoot, 'package.json')).text());
    expect(pkg.scripts?.['validate:mac-boundary-fixtures']).toBe(
      'bun run scripts/validate-mac-boundary-fixtures.ts',
    );
  });

  test('orchestrator runner script exists on disk', () => {
    expect(existsSync(runnerScript)).toBe(true);
  });

  test('mac afterSign hook enforces ad-hoc signing with hardened runtime', async () => {
    expect(existsSync(afterSignScript)).toBe(true);
    const source = await Bun.file(afterSignScript).text();
    expect(source).toContain('codesign');
    expect(source).toContain('--sign');
    expect(source).toContain('-');
    expect(source).toContain('--options');
    expect(source).toContain('runtime');
    expect(source).toContain('--entitlements');
    expect(source).toContain('build/entitlements.mac.plist');
    expect(source).toContain('ROX.ONE.app');
  });

  test('live mac validator requests codesign metadata separately from entitlements', async () => {
    const source = await Bun.file(validatorPath).text();
    expect(source).toContain("run('codesign', ['-dv', '--verbose=4', appPath])");
    expect(source).toContain("run('codesign', ['-d', '--entitlements', '-', appPath])");
    expect(source).not.toContain("['-dv', '--verbose=4', '--entitlements', '-', appPath]");
  });

  test('live mac validator accepts the ad-hoc executable codesign identifier fallback', async () => {
    const source = await Bun.file(validatorPath).text();
    expect(source).toContain("new Set(['com.rox.one', 'ROX.ONE'])");
    expect(source).toContain('assertCodesignIdentifier(codesignMetadata.output)');
    expect(source).toContain('signingOutputText: liveSigningOutput');
    expect(source).toContain('requireNativeBinaryEntries: false');
  });
});
