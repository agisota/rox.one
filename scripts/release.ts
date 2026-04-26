import { $ } from 'bun';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createManifest, loadEnvFile, type Arch, type BuildConfig, type Platform } from './build/common';

const REQUIRED_S3_ENV_VARS = [
  'S3_VERSIONS_BUCKET_ENDPOINT',
  'S3_VERSIONS_BUCKET_ACCESS_KEY_ID',
  'S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY',
] as const;

function resolvePlatform(): Platform {
  switch (process.platform) {
    case 'darwin':
    case 'linux':
    case 'win32':
      return process.platform;
    default:
      throw new Error(`Unsupported release platform: ${process.platform}`);
  }
}

function resolveArch(platform: Platform): Arch {
  if (platform === 'win32' && process.arch !== 'x64') {
    throw new Error(`Windows releases currently support only x64 (got ${process.arch})`);
  }

  switch (process.arch) {
    case 'arm64':
    case 'x64':
      return process.arch;
    default:
      throw new Error(`Unsupported release architecture: ${process.arch}`);
  }
}

function getBuildScript(platform: Platform): string {
  switch (platform) {
    case 'darwin':
      return 'electron:dist:dev:mac';
    case 'linux':
      return 'electron:dist:dev:linux';
    case 'win32':
      return 'electron:dist:dev:win';
  }
}

function getMissingS3EnvVars(): string[] {
  return REQUIRED_S3_ENV_VARS.filter((key) => !process.env[key]);
}

async function main(): Promise<void> {
  const rootDir = fileURLToPath(new URL('..', import.meta.url));
  const electronDir = join(rootDir, 'apps', 'electron');
  const platform = resolvePlatform();
  const arch = resolveArch(platform);

  const config: BuildConfig = {
    platform,
    arch,
    upload: true,
    uploadLatest: true,
    uploadScript: true,
    rootDir,
    electronDir,
  };

  await loadEnvFile(config);

  console.log('=== Release ===');
  console.log(`Platform: ${platform}-${arch}`);

  await $`cd ${rootDir} && bun run check-version`;
  await $`cd ${rootDir} && bun run oss:sync`;

  const buildScript = getBuildScript(platform);
  console.log(`Running ${buildScript}...`);
  await $`cd ${rootDir} && bun run ${buildScript}`;

  const version = await createManifest(config);
  const missingEnvVars = getMissingS3EnvVars();
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Release artifacts for v${version} were built locally, but deploy is blocked by missing S3 credentials: ${missingEnvVars.join(', ')}`
    );
  }

  console.log('Uploading release artifacts...');
  await $`cd ${rootDir} && bun run scripts/upload.ts --electron --latest --script`;

  console.log(`Release complete: v${version}`);
}

await main();
