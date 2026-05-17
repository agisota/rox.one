#!/usr/bin/env bun
/**
 * Linux signed-release pipeline contract validator (M.18 T254).
 *
 * Mirrors the Mac (T251) signed-release contract for the Linux
 * AppImage path. Asserts that
 * `.github/workflows/linux-signed-release.yml` and `package.json`
 * scripts stay aligned with the hardened signed-build contract:
 *  - manual-dispatch only (no pull_request / push triggers)
 *  - explicit tag-pattern guard step rejecting non-RC refs
 *  - secrets pre-flight that requires ROX_LINUX_GPG_KEY +
 *    ROX_LINUX_GPG_KEY_ID + ROX_LINUX_GPG_PASSPHRASE
 *  - pre-build boundary/fixture gate runs before electron:build
 *  - gpg detached signing step with `Good signature` grep
 *  - SHA-256 checksum manifest upload
 *  - workflow artifact upload of *.AppImage + *.AppImage.sig
 *
 * Idempotent: pure shape checks on tracked files, no side effects,
 * safe to run on any host.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message: string): never {
  console.error(`[linux-signed-release-pipeline] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function requireText(source: string, expected: string, description: string): void {
  if (!source.includes(expected)) {
    fail(`missing ${description}: ${expected}`);
  }
}

function refuseText(source: string, forbidden: string, description: string): void {
  if (source.includes(forbidden)) {
    fail(`forbidden token still present (${description}): ${forbidden}`);
  }
}

// 1. package.json contract: linux validator scripts + this pipeline
//    script must all be wired.
const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'validate:linux-private-release-boundary',
  'validate:linux-boundary-fixtures',
  'validate:linux-signed-release-pipeline',
  'validate:linux-deb-rpm',
  'electron:build',
]) {
  if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`);
  }
}

const pipelineScript = scripts['validate:linux-signed-release-pipeline'];
if (!pipelineScript.includes('scripts/validate-linux-signed-release-pipeline.ts')) {
  fail('validate:linux-signed-release-pipeline script does not invoke the validator file');
}

// 2. Workflow file must exist on disk.
const workflowPath = '.github/workflows/linux-signed-release.yml';
if (!existsSync(path.join(root, workflowPath))) {
  fail(`missing ${workflowPath}`);
}

const workflow = read(workflowPath);

// 3. Required shape: each token below is asserted by literal substring
//    match. We deliberately keep this list close to the Mac T251
//    contract so future maintainers can diff the two pipelines and
//    immediately see what is platform-specific (gpg vs. notarytool,
//    AppImage vs. DMG) vs. shared discipline (tag guard, secrets
//    pre-flight, artifact upload).
for (const [expected, description] of [
  ['name: Linux Signed Release', 'workflow display name'],
  ['workflow_dispatch:', 'manual dispatch trigger'],
  ['inputs:', 'workflow_dispatch inputs block'],
  ['tag:', 'manual tag input'],
  ['permissions:', 'explicit permissions block'],
  ['contents: read', 'read-only contents permission'],
  ['runs-on: ubuntu-22.04', 'pinned ubuntu runner'],
  // The next two refs accept either floating tag (legacy) or SHA-pinned
  // (current); validate:workflow-pins enforces the pinned form repo-wide.
  // Encoded as comment markers so requireText keeps its string-equality
  // contract — actual check happens below.
  ['oven-sh/setup-bun@', 'bun setup action'],
  ['actions/upload-artifact@', 'private artifact upload action'],
  ['if-no-files-found: error', 'hard artifact upload failure'],
  ['retention-days: 14', 'private artifact retention'],
  ['bun install --frozen-lockfile', 'frozen install'],
  ['bun run validate:linux-boundary-fixtures', 'linux fixture pre-build gate'],
  ['bun run validate:linux-private-release-boundary', 'linux trust-boundary pre-build gate'],
  ['bun run validate:linux-signed-release-pipeline', 'pipeline shape self-check'],
  ['bun run electron:build', 'Electron build step'],
  ['bunx electron-builder --linux --publish=never', 'linux electron-builder package step'],
  ['Validate release tag pattern', 'tag-protection guard step'],
  ['^v[0-9]+\\.[0-9]+\\.[0-9]+(-rc\\.[0-9]+)?$', 'tag-pattern regex anchor'],
  ['Verify signing secrets present', 'secrets pre-flight step'],
  ['ROX_LINUX_GPG_KEY', 'gpg private key secret reference'],
  ['ROX_LINUX_GPG_KEY_ID', 'gpg key id secret reference'],
  ['ROX_LINUX_GPG_PASSPHRASE', 'gpg passphrase secret reference'],
  ['GPG sign AppImage', 'gpg signing step'],
  ['gpg --batch --yes --import', 'gpg key import'],
  ['--detach-sign --armor', 'gpg detached + armored signing flags'],
  ['gpg --verify', 'gpg signature verification'],
  ['Good signature', 'gpg good-signature grep'],
  ['Compute signed artifact checksum', 'checksum manifest step'],
  ['release-checksums.txt', 'checksum manifest filename'],
  ['sha256sum', 'SHA-256 checksum computation'],
  ['name: rox-one-signed-linux-x64', 'signed-artifact upload name'],
  ['name: rox-one-linux-signed-release-evidence', 'evidence artifact upload name'],
  ['apps/electron/release/*.AppImage', 'AppImage upload glob'],
  ['apps/electron/release/*.AppImage.sig', 'signature sidecar upload glob'],
  ['.ci-logs/linux-signed-release', 'release log directory'],
  ['ROX_HEADLESS', 'headless env propagation'],
] as const) {
  requireText(workflow, expected, description);
}

// 4. Forbid auto-running triggers so a future copy/paste cannot
//    silently re-enable them. We match by line-anchored token to
//    stay tolerant of indentation inside `on:` while still rejecting
//    top-level re-enablement.
for (const [forbidden, description] of [
  ['  pull_request:', 'auto-run pull_request trigger'],
  ['  push:', 'auto-run push trigger'],
] as const) {
  refuseText(workflow, forbidden, description);
}

// 5. Ordering: tag guard must run before bun install (so a bad tag
//    aborts before we spend minutes on dependency install), and the
//    secrets pre-flight must run before electron-builder (so a
//    missing gpg secret aborts before the long package step).
const tagGuardIndex = workflow.indexOf('Validate release tag pattern');
const bunInstallIndex = workflow.indexOf('bun install --frozen-lockfile');
if (tagGuardIndex < 0 || bunInstallIndex < 0) {
  fail('tag-protection guard or bun install step missing');
}
if (tagGuardIndex > bunInstallIndex) {
  fail('Validate release tag pattern must run before bun install --frozen-lockfile');
}

const secretsIndex = workflow.indexOf('Verify signing secrets present');
const electronBuilderIndex = workflow.indexOf('Package Linux AppImage');
if (secretsIndex < 0 || electronBuilderIndex < 0) {
  fail('secrets pre-flight or electron-builder step missing');
}
if (secretsIndex > electronBuilderIndex) {
  fail('Verify signing secrets present must run before Package Linux AppImage');
}

const signStepIndex = workflow.indexOf('GPG sign AppImage');
const checksumIndex = workflow.indexOf('Compute signed artifact checksum');
if (signStepIndex < 0 || checksumIndex < 0) {
  fail('gpg sign step or checksum step missing');
}
if (signStepIndex > checksumIndex) {
  fail('GPG sign AppImage must run before Compute signed artifact checksum');
}

// 6. Forbid command-injection: any untrusted expression must live
//    inside an `env:` block, never inside a `run:` script body.
//    Scan line-by-line, ignore lines that are part of an env: block.
function rejectInlineExpression(expression: string, description: string): void {
  let inEnv = false;
  let envIndent = -1;
  for (const rawLine of workflow.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.length === 0) continue;
    const indent = (line.match(/^( *)/)?.[1].length) ?? 0;
    const trimmed = line.trim();
    if (trimmed === 'env:') { inEnv = true; envIndent = indent; continue; }
    if (inEnv && indent <= envIndent) { inEnv = false; envIndent = -1; }
    if (inEnv) continue;
    if (line.includes(expression)) {
      fail(`${description}: ${expression} must be passed via env, not inlined in run:`);
    }
  }
}

rejectInlineExpression('${{ inputs.tag }}', 'inputs.tag inline expression');
rejectInlineExpression('${{ secrets.ROX_LINUX_GPG_KEY }}', 'gpg key inline expression');
rejectInlineExpression('${{ secrets.ROX_LINUX_GPG_KEY_ID }}', 'gpg key-id inline expression');
rejectInlineExpression('${{ secrets.ROX_LINUX_GPG_PASSPHRASE }}', 'gpg passphrase inline expression');

console.log('[linux-signed-release-pipeline] ok: manual-dispatch + tag-guard + gpg-secrets pre-flight + signing + checksum asserted');
