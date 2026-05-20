import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const DEFAULT_SOURCE = '/Applications/Open Design.app/Contents/Resources';
const TARGET_DIR = resolve(ROOT_DIR, 'apps/electron/resources/rox-design');

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

const COPY_PATHS = [
  'open-design-config.json',
  'app/prebundled',
  'app/node_modules',
  'open-design',
  'open-design-web-standalone',
] as const;

function fail(message: string): never {
  console.error(`[rox-design:prepare] ${message}`);
  process.exit(1);
}

interface ParsedArgs {
  checkOnly: boolean;
  force: boolean;
  fromArchive: string | undefined;
  expectedSha256: string | undefined;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = new Set(argv);
  let fromArchive: string | undefined;
  let expectedSha256: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--from-archive=')) fromArchive = arg.slice('--from-archive='.length);
    else if (arg.startsWith('--expected-sha256=')) expectedSha256 = arg.slice('--expected-sha256='.length);
  }
  return {
    checkOnly: args.has('--check'),
    force: args.has('--force'),
    fromArchive,
    expectedSha256,
  };
}

function validateSourceDirectory(sourceRoot: string): { version: string } {
  if (!existsSync(sourceRoot)) fail(`source resources root does not exist: ${sourceRoot}`);
  const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(sourceRoot, relativePath)));
  if (missing.length > 0) {
    fail(`source resources root is incomplete:\n${missing.map((p) => `  - ${p}`).join('\n')}`);
  }
  const config = JSON.parse(readFileSync(join(sourceRoot, 'open-design-config.json'), 'utf8')) as { appVersion?: string };
  return { version: config.appVersion || 'unknown' };
}

function targetHasPayload(): boolean {
  if (!existsSync(TARGET_DIR)) return false;
  return readdirSync(TARGET_DIR).some((entry) => !['README.md', '.DS_Store'].includes(entry));
}

function cleanTargetExceptReadme(): void {
  mkdirSync(TARGET_DIR, { recursive: true });
  for (const entry of readdirSync(TARGET_DIR)) {
    if (entry === 'README.md') continue;
    rmSync(join(TARGET_DIR, entry), { recursive: true, force: true });
  }
}

function sha256OfFile(path: string): string {
  const hash = createHash('sha256');
  hash.update(readFileSync(path));
  return hash.digest('hex');
}

async function downloadToFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) fail(`failed to download archive: HTTP ${response.status} ${response.statusText} (${url})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destination, buffer);
}

async function resolveArchivePath(fromArchive: string): Promise<{ path: string; cleanup: () => void }> {
  // file:// scheme or absolute/relative local path → treat as local
  if (fromArchive.startsWith('file://')) {
    const localPath = fromArchive.slice('file://'.length);
    if (!existsSync(localPath)) fail(`archive not found: ${localPath}`);
    return { path: localPath, cleanup: () => {} };
  }
  if (fromArchive.startsWith('http://') || fromArchive.startsWith('https://')) {
    const tempDir = mkdtempSync(join(tmpdir(), 'rox-design-archive-'));
    const archivePath = join(tempDir, 'payload.tar.gz');
    console.log(`[rox-design:prepare] downloading archive from ${fromArchive}`);
    await downloadToFile(fromArchive, archivePath);
    return { path: archivePath, cleanup: () => rmSync(tempDir, { recursive: true, force: true }) };
  }
  // Treat as a local filesystem path
  const localPath = resolve(fromArchive);
  if (!existsSync(localPath)) fail(`archive not found: ${localPath}`);
  return { path: localPath, cleanup: () => {} };
}

function verifyArchiveSha256(archivePath: string, expectedSha256: string): string {
  const actual = sha256OfFile(archivePath);
  const expected = expectedSha256.toLowerCase().trim();
  if (actual !== expected) {
    fail(`archive SHA-256 mismatch:\n  expected: ${expected}\n  actual:   ${actual}`);
  }
  console.log(`[rox-design:prepare] archive SHA-256 verified: ${actual}`);
  return actual;
}

function extractTarGz(archivePath: string, targetDir: string): void {
  // Use system tar to preserve symlinks and Mach-O permissions. -z handles .tar.gz.
  // `--strip-components=1` is intentionally NOT set; the canonical archive is
  // expected to extract to a root with the same layout as `<source>/Contents/Resources`.
  execFileSync('tar', ['-xzf', archivePath, '-C', targetDir], { stdio: 'inherit' });
}

async function prepareFromArchive(parsed: ParsedArgs): Promise<{ version: string; archiveSha256: string; archiveSource: string }> {
  const fromArchive = parsed.fromArchive!;
  if (!parsed.expectedSha256) {
    fail('--expected-sha256=<hex> is required when --from-archive is set (supply-chain integrity)');
  }

  const { path: archivePath, cleanup } = await resolveArchivePath(fromArchive);
  try {
    const archiveSha256 = verifyArchiveSha256(archivePath, parsed.expectedSha256);

    if (targetHasPayload() && !parsed.force) {
      fail(`target already contains a runtime payload: ${TARGET_DIR}\nRe-run with --force to replace it.`);
    }
    cleanTargetExceptReadme();
    extractTarGz(archivePath, TARGET_DIR);

    // Validate the extracted layout matches REQUIRED_PATHS.
    const missing = REQUIRED_PATHS.filter((relativePath) => !existsSync(join(TARGET_DIR, relativePath)));
    if (missing.length > 0) {
      fail(`extracted archive is incomplete:\n${missing.map((p) => `  - ${p}`).join('\n')}`);
    }

    const config = JSON.parse(readFileSync(join(TARGET_DIR, 'open-design-config.json'), 'utf8')) as { appVersion?: string };
    const version = config.appVersion || 'unknown';

    return { version, archiveSha256, archiveSource: fromArchive };
  } finally {
    cleanup();
  }
}

async function prepareFromHostLocal(parsed: ParsedArgs): Promise<{ version: string; sourceRoot: string }> {
  const sourceRoot = resolve(process.env.ROX_DESIGN_SOURCE_RESOURCES || DEFAULT_SOURCE);
  const { version } = validateSourceDirectory(sourceRoot);

  if (parsed.checkOnly) {
    console.log(`[rox-design:prepare] source ok: ${sourceRoot}`);
    console.log(`[rox-design:prepare] Open Design version: ${version}`);
    console.log(`[rox-design:prepare] target: ${TARGET_DIR}`);
    process.exit(0);
  }

  if (targetHasPayload() && !parsed.force) {
    fail(`target already contains a runtime payload: ${TARGET_DIR}\nRe-run with --force to replace it.`);
  }

  cleanTargetExceptReadme();
  for (const relativePath of COPY_PATHS) {
    const from = join(sourceRoot, relativePath);
    const to = join(TARGET_DIR, relativePath);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true, force: true, dereference: true });
    console.log(`[rox-design:prepare] copied ${relativePath}`);
  }

  return { version, sourceRoot };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.fromArchive) {
    if (parsed.checkOnly) {
      console.log(`[rox-design:prepare] check mode: archive ${parsed.fromArchive}`);
      console.log(`[rox-design:prepare] target: ${TARGET_DIR}`);
      // Resolve to verify the archive is reachable, but do not extract.
      const { path, cleanup } = await resolveArchivePath(parsed.fromArchive);
      try {
        if (parsed.expectedSha256) verifyArchiveSha256(path, parsed.expectedSha256);
        else console.log('[rox-design:prepare] (no --expected-sha256 — integrity not verified in check mode)');
      } finally {
        cleanup();
      }
      process.exit(0);
    }

    const { version, archiveSha256, archiveSource } = await prepareFromArchive(parsed);
    writeManifest({ version, archiveSource, archiveSha256 });
    console.log(`[rox-design:prepare] prepared Open Design ${version} runtime from archive at ${TARGET_DIR}`);
    return;
  }

  const { version, sourceRoot } = await prepareFromHostLocal(parsed);
  writeManifest({ version, sourceRoot });
  console.log(`[rox-design:prepare] prepared Open Design ${version} runtime at ${TARGET_DIR}`);
  console.log('[rox-design:prepare] payload is gitignored; build artifacts pick it up through electron-builder resources.');
}

interface ManifestInput {
  version: string;
  sourceRoot?: string;
  archiveSource?: string;
  archiveSha256?: string;
}

function writeManifest(input: ManifestInput): void {
  writeFileSync(
    join(TARGET_DIR, 'MANIFEST.json'),
    `${JSON.stringify(
      {
        schema: 'rox-design-runtime-manifest.v1',
        ...(input.sourceRoot ? { sourceRoot: input.sourceRoot } : {}),
        ...(input.archiveSource ? { archiveSource: input.archiveSource } : {}),
        ...(input.archiveSha256 ? { archiveSha256: input.archiveSha256 } : {}),
        version: input.version,
        copiedAt: new Date().toISOString(),
        copiedPaths: COPY_PATHS,
      },
      null,
      2,
    )}\n`,
  );
}

await main();
