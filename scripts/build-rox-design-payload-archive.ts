#!/usr/bin/env bun
/**
 * Build a canonical content-addressed Rox Design runtime payload archive.
 *
 * Output: rox-design-payload-<openDesignVersion>-<gitShaShort>.tar.gz
 * containing the layout that scripts/prepare-rox-design-runtime.ts --from-archive
 * expects (the same directory tree as REQUIRED_PATHS at the source).
 *
 * Run on a host with Open Design 0.7.0 installed (typically a self-hosted
 * mac runner via .github/workflows/build-rox-design-payload-archive.yml).
 *
 * Tracked in Linear as PZD-51 (B-REPRO-2).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const DEFAULT_SOURCE = '/Applications/Open Design.app/Contents/Resources';
const DEFAULT_OUTPUT_DIR = '/tmp';

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

const TAR_PATHS = [
  'open-design-config.json',
  'app/prebundled',
  'app/node_modules',
  'open-design',
  'open-design-web-standalone',
] as const;

interface CliArgs {
  source: string;
  outputDir: string;
  uploadTo: string | undefined;
  versionsManifest: string | undefined;
  dryRun: boolean;
}

function fail(message: string): never {
  console.error(`[rox-design:build-archive] ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  let source: string | undefined;
  let outputDir: string | undefined;
  let uploadTo: string | undefined;
  let versionsManifest: string | undefined;
  let dryRun = false;
  for (const arg of argv) {
    if (arg.startsWith('--source=')) source = arg.slice('--source='.length);
    else if (arg.startsWith('--output-dir=')) outputDir = arg.slice('--output-dir='.length);
    else if (arg.startsWith('--upload-to=')) uploadTo = arg.slice('--upload-to='.length);
    else if (arg.startsWith('--versions-manifest=')) versionsManifest = arg.slice('--versions-manifest='.length);
    else if (arg === '--dry-run') dryRun = true;
  }
  return {
    source: resolve(source || process.env.ROX_DESIGN_SOURCE_RESOURCES || DEFAULT_SOURCE),
    outputDir: resolve(outputDir || DEFAULT_OUTPUT_DIR),
    uploadTo,
    versionsManifest,
    dryRun,
  };
}

function validateSource(source: string): { version: string } {
  if (!existsSync(source)) fail(`source resources root does not exist: ${source}`);
  const missing = REQUIRED_PATHS.filter((p) => !existsSync(join(source, p)));
  if (missing.length > 0) fail(`source is incomplete:\n${missing.map((p) => `  - ${p}`).join('\n')}`);
  const config = JSON.parse(readFileSync(join(source, 'open-design-config.json'), 'utf8')) as { appVersion?: string };
  if (!config.appVersion) fail('source open-design-config.json is missing appVersion');
  return { version: config.appVersion };
}

function gitShaShort(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT_DIR }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function sha256OfFile(path: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

function buildTarball(source: string, archivePath: string): void {
  console.log(`[rox-design:build-archive] tar -czf ${archivePath}`);
  execFileSync('tar', ['-czf', archivePath, '-C', source, ...TAR_PATHS], { stdio: 'inherit' });
}

function uploadToS3(archivePath: string, s3Target: string): void {
  if (!s3Target.startsWith('s3://')) fail(`--upload-to must be s3:// URL, got: ${s3Target}`);
  const target = s3Target.endsWith('/') ? s3Target : `${s3Target}/`;
  console.log(`[rox-design:build-archive] aws s3 cp ${archivePath} ${target}`);
  execFileSync('aws', ['s3', 'cp', archivePath, target], { stdio: 'inherit' });
}

interface VersionsManifestEntry {
  openDesignVersion: string;
  preparedAt: string;
  integrationCommit: string;
  archiveUrl: string;
  archiveSha256: string;
  archiveSizeBytes: number;
}

interface VersionsManifest {
  schema: 'rox-design-runtime-payload-versions.v1';
  current?: string;
  versions: Record<string, VersionsManifestEntry>;
}

function readVersionsManifest(path: string): VersionsManifest {
  if (!existsSync(path)) return { schema: 'rox-design-runtime-payload-versions.v1', versions: {} };
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as VersionsManifest;
  if (parsed.schema !== 'rox-design-runtime-payload-versions.v1') {
    fail(`versions manifest schema mismatch at ${path}: ${parsed.schema}`);
  }
  return parsed;
}

function updateVersionsManifest(a: { manifestPath: string; versionKey: string; entry: VersionsManifestEntry; makeCurrent: boolean }): void {
  const manifest = readVersionsManifest(a.manifestPath);
  manifest.versions[a.versionKey] = a.entry;
  if (a.makeCurrent || !manifest.current) manifest.current = a.versionKey;
  writeFileSync(a.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[rox-design:build-archive] updated ${a.manifestPath} — current=${manifest.current}`);
}

function deriveArchiveUrl(uploadTo: string | undefined, archiveName: string): string {
  if (!uploadTo) return `file:///${archiveName}`;
  const prefix = uploadTo.endsWith('/') ? uploadTo : `${uploadTo}/`;
  const match = /^s3:\/\/([^/]+)\/(.*)$/.exec(prefix);
  if (!match) return `${prefix}${archiveName}`;
  const [, bucket, keyPrefix] = match;
  return `https://${bucket}.s3.amazonaws.com/${keyPrefix}${archiveName}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { version } = validateSource(args.source);
  const sha = gitShaShort();
  const versionKey = `${version}-${sha}`;
  const archiveName = `rox-design-payload-${versionKey}.tar.gz`;
  const archivePath = join(args.outputDir, archiveName);

  console.log(`[rox-design:build-archive] source: ${args.source}`);
  console.log(`[rox-design:build-archive] Open Design version: ${version}`);
  console.log(`[rox-design:build-archive] integration commit: ${sha}`);
  console.log(`[rox-design:build-archive] output: ${archivePath}`);

  if (args.dryRun) {
    console.log('[rox-design:build-archive] --dry-run: skipping tar + upload + manifest update');
    return;
  }

  buildTarball(args.source, archivePath);
  const archiveSha256 = sha256OfFile(archivePath);
  const archiveSizeBytes = statSync(archivePath).size;

  console.log(`[rox-design:build-archive] archive SHA-256: ${archiveSha256}`);
  console.log(`[rox-design:build-archive] archive size:    ${archiveSizeBytes} bytes`);

  if (args.uploadTo) uploadToS3(archivePath, args.uploadTo);
  else console.log('[rox-design:build-archive] (no --upload-to set; archive stays local)');

  if (args.versionsManifest) {
    updateVersionsManifest({
      manifestPath: resolve(args.versionsManifest),
      versionKey,
      entry: {
        openDesignVersion: version,
        preparedAt: new Date().toISOString(),
        integrationCommit: sha,
        archiveUrl: deriveArchiveUrl(args.uploadTo, archiveName),
        archiveSha256,
        archiveSizeBytes,
      },
      makeCurrent: true,
    });
  }

  console.log('');
  console.log('=== copy-paste for downstream release lanes ===');
  console.log(`ARCHIVE_URL=${deriveArchiveUrl(args.uploadTo, archiveName)}`);
  console.log(`ARCHIVE_SHA=${archiveSha256}`);
  console.log('bun run rox-design:prepare -- \\');
  console.log('  --from-archive="$ARCHIVE_URL" \\');
  console.log('  --expected-sha256="$ARCHIVE_SHA" \\');
  console.log('  --force');
}

await main();
