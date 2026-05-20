#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const TARGET_DIR = resolve(ROOT_DIR, 'apps/electron/resources/rox-design');
const MANIFEST_PATH = join(TARGET_DIR, 'MANIFEST.json');
const MANIFEST_SCHEMA = 'rox-design-runtime-manifest.v1';

const REQUIRED_PATHS = [
  'open-design-config.json',
  'app/prebundled/daemon/daemon-sidecar.mjs',
  'app/prebundled/daemon/daemon-cli.mjs',
  'app/node_modules/better-sqlite3',
  'app/node_modules/blake3-wasm',
  'app/prebundled/web-sidecar.mjs',
  'open-design/bin/node',
  'open-design/skills',
  'open-design/design-systems',
  'open-design/design-templates',
  'open-design/prompt-templates',
  'open-design-web-standalone/apps/web/server.js',
] as const;

interface Manifest {
  schema?: string;
  version?: string;
  sourceRoot?: string;
  copiedAt?: string;
  copiedPaths?: string[];
}

function fail(message: string): never {
  console.error(`[rox-design:payload:verify] ${message}`);
  console.error('[rox-design:payload:verify]');
  console.error('[rox-design:payload:verify] Bootstrap the runtime payload before packaging:');
  console.error('[rox-design:payload:verify]   ROX_DESIGN_SOURCE_RESOURCES="<Open Design.app resources>" \\');
  console.error('[rox-design:payload:verify]     bun run rox-design:prepare -- --force');
  console.error('[rox-design:payload:verify]');
  console.error('[rox-design:payload:verify] Dev-only bypass (packaged Rox Design WILL NOT WORK):');
  console.error('[rox-design:payload:verify]   ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1');
  process.exit(1);
}

if (process.env.ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY === '1') {
  console.warn(
    '[rox-design:payload:verify] SKIPPED (ROX_SKIP_ROX_DESIGN_PAYLOAD_VERIFY=1) — packaged Rox Design will be broken.',
  );
  process.exit(0);
}

if (!existsSync(TARGET_DIR)) fail(`payload directory does not exist: ${TARGET_DIR}`);
if (!existsSync(MANIFEST_PATH)) {
  fail(`MANIFEST.json missing at ${MANIFEST_PATH} — Open Design runtime payload has not been prepared.`);
}

let manifest: Manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
} catch (error) {
  fail(`MANIFEST.json is not valid JSON: ${(error as Error).message}`);
}

if (manifest.schema !== MANIFEST_SCHEMA) {
  fail(`MANIFEST.json schema mismatch: expected "${MANIFEST_SCHEMA}", got "${manifest.schema ?? 'undefined'}"`);
}
if (!manifest.version) fail('MANIFEST.json is missing "version"');

const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(TARGET_DIR, relativePath)));
if (missing.length > 0) {
  fail(
    `payload is incomplete (${missing.length} missing required paths):\n${missing.map((p) => `  - ${p}`).join('\n')}`,
  );
}

const topLevel = readdirSync(TARGET_DIR).filter((entry) => entry !== '.DS_Store');
console.log(`[rox-design:payload:verify] OK — Open Design ${manifest.version} payload at ${TARGET_DIR}`);
console.log(
  `[rox-design:payload:verify] sourceRoot=${manifest.sourceRoot ?? '<unknown>'} copiedAt=${manifest.copiedAt ?? '<unknown>'}`,
);
console.log(`[rox-design:payload:verify] top-level entries: ${topLevel.join(', ')}`);
