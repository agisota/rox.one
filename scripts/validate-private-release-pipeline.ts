#!/usr/bin/env bun
/**
 * Private release pipeline contract validator (M.17 T256).
 *
 * Asserts that `.github/workflows/private-release.yml`, package.json scripts,
 * and the mac-arm-build workflow stay aligned with the hardened private-RC
 * contract:
 *  - manual-dispatch only (no pull_request / push triggers)
 *  - explicit tag-pattern guard step rejecting non-RC refs
 *  - pre-build validation gate runs rebrand + agent-contract + release +
 *    mac-private-release-boundary before electron:build
 *  - installer paths uploaded as `release-artifacts`
 *  - SHA-256 checksum manifest uploaded as `release-checksums`
 *
 * Idempotent: re-running against the same SHA yields the same exit code
 * because every assertion is a pure shape check on tracked files.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function fail(message: string): never {
  console.error(`[private-release-pipeline] ${message}`);
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

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts ?? {};

for (const scriptName of [
  'validate:docs',
  'validate:rebrand',
  'validate:agent-contract',
  'validate:mac-private-release-boundary',
  'lint',
  'typecheck:all',
  'test',
  'electron:build',
  'validate:bundle-policy',
  'validate:mac-arm-build-workflow',
  'validate:private-release-pipeline',
  'validate:release',
]) {
  if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`);
  }
}

const validateRelease = scripts['validate:release'];
for (const requiredCommand of [
  'validate:docs',
  'lint',
  'typecheck:all',
  'bun test',
  'electron:build',
  'validate:bundle-policy',
  'validate:mac-arm-build-workflow',
  'validate:private-release-pipeline',
]) {
  if (!validateRelease.includes(requiredCommand)) {
    fail(`validate:release does not include ${requiredCommand}`);
  }
}

const validateCi = scripts['validate:ci'];
if (!validateCi.includes('validate:private-release-pipeline')) {
  fail('validate:ci does not include validate:private-release-pipeline');
}

const workflowPath = '.github/workflows/private-release.yml';
if (!existsSync(path.join(root, workflowPath))) {
  fail(`missing ${workflowPath}`);
}

const workflow = read(workflowPath);

// T256: Manual-dispatch-only contract. The previous pull_request + push
// triggers were dropped to stop burning macOS minutes on every PR. Reject
// regression by name.
for (const [expected, description] of [
  ['name: Private Release Candidate', 'private release workflow name'],
  ['workflow_dispatch:', 'manual dispatch trigger'],
  ['inputs:', 'workflow_dispatch inputs block'],
  ['tag:', 'manual tag input'],
  ['permissions:', 'explicit permissions block'],
  ['contents: read', 'read-only contents permission'],
  // SHA pin tolerant — exact form enforced by validate:workflow-pins.
  ['actions/upload-artifact@', 'private artifact upload action'],
  ['if-no-files-found: error', 'hard artifact upload failure'],
  ['retention-days: 14', 'private artifact retention'],
  ['bun install --frozen-lockfile', 'frozen install'],
  ['bun run validate:private-release-pipeline', 'pipeline contract validation'],
  ['bun run validate:rebrand', 'rebrand pre-build gate'],
  ['bun run validate:agent-contract', 'agent-contract pre-build gate'],
  ['bun run validate:release', 'release orchestrator pre-build gate'],
  ['bun run validate:mac-private-release-boundary', 'mac-trust-boundary pre-build gate'],
  ['bun run validate:docs', 'docs validation gate'],
  ['bun run lint', 'lint gate'],
  ['bun run typecheck:all', 'typecheck gate'],
  ['bun test', 'full deterministic test gate'],
  ['bun run electron:build', 'Electron build gate'],
  ['bun run validate:bundle-policy', 'bundle policy gate'],
  ['bun run validate:mac-arm-build-workflow', 'Mac ARM workflow contract gate'],
  ['.ci-logs/private-release', 'release log directory'],
  ['apps/electron/dist', 'Electron dist artifact path'],
  ['docs/release', 'release docs artifact path'],
  // T256 hardening tokens
  ['Pre-build validation gate', 'pre-build validation gate step'],
  ['Validate release tag pattern', 'tag-protection guard step'],
  ['^v[0-9]+\\.[0-9]+\\.[0-9]+(-rc\\.[0-9]+)?$', 'tag-pattern regex anchor'],
  ['name: release-artifacts', 'release-artifacts upload name'],
  ['name: release-checksums', 'release-checksums upload name'],
  ['release-checksums.txt', 'checksum manifest filename'],
  ['shasum -a 256', 'SHA-256 checksum computation'],
  ['apps/electron/release/**/*.dmg', 'DMG installer upload glob'],
  ['apps/electron/release/**/*.zip', 'zip installer upload glob'],
] as const) {
  requireText(workflow, expected, description);
}

// T256: Forbid the dropped triggers so a future copy/paste cannot re-enable
// them silently. We match by line-anchored token to stay tolerant of
// indentation inside `on:` while still rejecting top-level re-enablement.
for (const [forbidden, description] of [
  ['  pull_request:', 'dropped pull_request trigger'],
  ['  push:', 'dropped push trigger'],
] as const) {
  refuseText(workflow, forbidden, description);
}

// T256: Pre-build gate ordering. The validation gate step must appear BEFORE
// the `bun run electron:build` step so we never burn build cycles on a
// pipeline that is already broken.
const preBuildGateIndex = workflow.indexOf('Pre-build validation gate');
const electronBuildIndex = workflow.indexOf('bun run electron:build');
if (preBuildGateIndex < 0 || electronBuildIndex < 0) {
  fail('pre-build gate or electron:build step missing');
}
if (preBuildGateIndex > electronBuildIndex) {
  fail('Pre-build validation gate must run before bun run electron:build');
}

// T256: Tag guard must run before install so we never spend minutes on a
// non-tag dispatch. Check ordering vs. `bun install`.
const tagGuardIndex = workflow.indexOf('Validate release tag pattern');
const bunInstallIndex = workflow.indexOf('bun install --frozen-lockfile');
if (tagGuardIndex < 0 || bunInstallIndex < 0) {
  fail('tag-protection guard or bun install step missing');
}
if (tagGuardIndex > bunInstallIndex) {
  fail('Validate release tag pattern must run before bun install --frozen-lockfile');
}

// T256: Forbid command injection patterns. The tag-guard step must consume
// `inputs.tag` via an env var, never inline as ${{ ... }} inside a `run:`.
if (/run:[^|]*\$\{\{\s*github\.event\.inputs\.tag\s*\}\}/.test(workflow)) {
  fail('github.event.inputs.tag must be passed via env, not inlined in run:');
}

const macArmWorkflow = read('.github/workflows/mac-arm-build.yml');
for (const requiredText of [
  'runs-on: macos-15-xlarge',
  'bun run electron:dist:dev:mac:arm64',
  'bun run validate:packaged-artifacts',
  'bun run validate:mac-private-release-boundary',
  // SHA pin tolerant — exact form enforced by validate:workflow-pins.
  'actions/upload-artifact@',
  'if-no-files-found: error',
]) {
  requireText(macArmWorkflow, requiredText, 'Mac ARM workflow release gate');
}

// T256: Audit doc must exist and anchor the T256 hardening narrative.
const auditDocPath = 'docs/release/private-release-pipeline-audit.md';
if (!existsSync(path.join(root, auditDocPath))) {
  fail(`missing audit doc: ${auditDocPath}`);
}
const auditDoc = read(auditDocPath);
requireText(auditDoc, 'M.17 T256', 'audit doc T256 anchor');
requireText(auditDoc, 'workflow_dispatch', 'audit doc covers manual-dispatch hardening');
requireText(auditDoc, 'SHA-256', 'audit doc covers checksum manifest');

console.log('[private-release-pipeline] ok: manual-dispatch + tag-guard + pre-build gate + checksums asserted');
