import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import { basename, join } from 'path';
import { fileURLToPath } from 'url';

type CliFlags = {
  electron: boolean;
  latest: boolean;
  script: boolean;
};

type UploadTarget = {
  bucket: string;
  clientEndpoint: string;
  basePrefix: string;
};

type BinaryInfo = {
  url: string;
  sha256: string;
  size: number;
  filename: string;
};

const RELEASE_FILE_EXCLUDES = new Set(['builder-debug.yml']);
const PUBLIC_VERSIONS_URL = process.env.PUBLIC_VERSIONS_URL || 'https://app.rox.one/electron';
const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const RELEASE_DIR = join(ROOT_DIR, 'apps', 'electron', 'release');
const UPLOAD_MANIFEST_PATH = join(ROOT_DIR, '.build', 'upload', 'manifest.json');
const INSTALLER_SCRIPTS = [
  join(ROOT_DIR, 'scripts', 'install-app.sh'),
  join(ROOT_DIR, 'scripts', 'install-app.ps1'),
];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseArgs(argv: string[]): CliFlags {
  const flags: CliFlags = {
    electron: false,
    latest: false,
    script: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case '--electron':
        flags.electron = true;
        break;
      case '--latest':
        flags.latest = true;
        break;
      case '--script':
        flags.script = true;
        break;
      default:
        throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (!flags.electron && !flags.script) {
    throw new Error('Nothing to upload. Use --electron and/or --script.');
  }

  return flags;
}

function buildKey(...parts: Array<string | undefined>): string {
  return parts
    .flatMap((part) => (part ? part.split('/').filter(Boolean) : []))
    .join('/');
}

function getContentType(fileName: string): string {
  if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'application/x-yaml';
  if (fileName.endsWith('.json')) return 'application/json';
  if (fileName.endsWith('.sh')) return 'text/x-shellscript; charset=utf-8';
  if (fileName.endsWith('.ps1')) return 'text/plain; charset=utf-8';
  if (fileName.endsWith('.dmg')) return 'application/x-apple-diskimage';
  if (fileName.endsWith('.zip')) return 'application/zip';
  if (fileName.endsWith('.blockmap')) return 'application/octet-stream';
  if (fileName.endsWith('.AppImage')) return 'application/octet-stream';
  if (fileName.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  return 'application/octet-stream';
}

function parseUploadTarget(rawEndpoint: string): UploadTarget {
  const endpointUrl = new URL(rawEndpoint);
  const explicitBucket = process.env.S3_VERSIONS_BUCKET_NAME?.trim();
  const pathSegments = endpointUrl.pathname.split('/').filter(Boolean);

  if (explicitBucket) {
    return {
      bucket: explicitBucket,
      clientEndpoint: `${endpointUrl.protocol}//${endpointUrl.host}`,
      basePrefix: pathSegments.join('/'),
    };
  }

  if (pathSegments.length === 0) {
    throw new Error(
      'S3_VERSIONS_BUCKET_ENDPOINT must include the bucket in its path, or set S3_VERSIONS_BUCKET_NAME explicitly.'
    );
  }

  return {
    bucket: pathSegments[0],
    clientEndpoint: `${endpointUrl.protocol}//${endpointUrl.host}`,
    basePrefix: pathSegments.slice(1).join('/'),
  };
}

async function createSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}

async function loadReleaseVersion(): Promise<string> {
  const raw = await readFile(UPLOAD_MANIFEST_PATH, 'utf8');
  const parsed = JSON.parse(raw) as { version?: string };

  if (!parsed.version) {
    throw new Error(`Missing version in ${UPLOAD_MANIFEST_PATH}`);
  }

  return parsed.version;
}

async function listReleaseFiles(): Promise<string[]> {
  const entries = await readdir(RELEASE_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !RELEASE_FILE_EXCLUDES.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function inferBinaryEntry(fileName: string): { platformKey: string; priority: number } | null {
  let match = fileName.match(/^ROX-ONE-(arm64|x64)\.zip$/);
  if (match) {
    return { platformKey: `darwin-${match[1]}`, priority: 2 };
  }

  match = fileName.match(/^ROX-ONE-(arm64|x64)\.dmg$/);
  if (match) {
    return { platformKey: `darwin-${match[1]}`, priority: 1 };
  }

  match = fileName.match(/^ROX-ONE-(arm64|x64)\.AppImage$/);
  if (match) {
    return { platformKey: `linux-${match[1]}`, priority: 1 };
  }

  match = fileName.match(/^ROX-ONE-(arm64|x64)\.exe$/);
  if (match) {
    return { platformKey: `win32-${match[1]}`, priority: 1 };
  }

  return null;
}

async function buildVersionManifest(version: string, releaseFiles: string[]): Promise<string> {
  const selected = new Map<string, { fileName: string; priority: number }>();

  for (const fileName of releaseFiles) {
    const entry = inferBinaryEntry(fileName);
    if (!entry) continue;

    const current = selected.get(entry.platformKey);
    if (!current || entry.priority > current.priority) {
      selected.set(entry.platformKey, { fileName, priority: entry.priority });
    }
  }

  const binaries: Record<string, BinaryInfo> = {};
  for (const [platformKey, { fileName }] of selected.entries()) {
    const filePath = join(RELEASE_DIR, fileName);
    const fileStats = await stat(filePath);
    const sha256 = await createSha256(filePath);

    binaries[platformKey] = {
      url: `${PUBLIC_VERSIONS_URL}/${version}/${fileName}`,
      sha256,
      size: fileStats.size,
      filename: fileName,
    };
  }

  const manifest = {
    version,
    build_time: new Date().toISOString(),
    build_timestamp: Date.now(),
    binaries,
  };

  return JSON.stringify(manifest, null, 2);
}

function createS3Client(target: UploadTarget): S3Client {
  const region =
    process.env.S3_VERSIONS_BUCKET_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'auto';

  return new S3Client({
    region,
    endpoint: target.clientEndpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv('S3_VERSIONS_BUCKET_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY'),
    },
  });
}

async function uploadText(
  client: S3Client,
  target: UploadTarget,
  key: string,
  body: string,
  contentType: string
): Promise<void> {
  const resolvedKey = buildKey(target.basePrefix, key);
  await client.send(
    new PutObjectCommand({
      Bucket: target.bucket,
      Key: resolvedKey,
      Body: Buffer.from(body, 'utf8'),
      ContentType: contentType,
    })
  );
  console.log(`Uploaded ${resolvedKey}`);
}

async function uploadFile(
  client: S3Client,
  target: UploadTarget,
  sourcePath: string,
  key: string
): Promise<void> {
  const resolvedKey = buildKey(target.basePrefix, key);
  const fileStats = await stat(sourcePath);

  await client.send(
    new PutObjectCommand({
      Bucket: target.bucket,
      Key: resolvedKey,
      Body: createReadStream(sourcePath),
      ContentLength: fileStats.size,
      ContentType: getContentType(basename(sourcePath)),
    })
  );

  console.log(`Uploaded ${resolvedKey}`);
}

async function uploadReleaseFiles(
  client: S3Client,
  target: UploadTarget,
  version: string,
  releaseFiles: string[],
  uploadLatest: boolean
): Promise<void> {
  for (const fileName of releaseFiles) {
    const sourcePath = join(RELEASE_DIR, fileName);
    await uploadFile(client, target, sourcePath, buildKey('electron', version, fileName));

    if (uploadLatest) {
      await uploadFile(client, target, sourcePath, buildKey('electron', 'latest', fileName));
    }
  }
}

async function uploadInstallerScripts(client: S3Client, target: UploadTarget): Promise<void> {
  for (const scriptPath of INSTALLER_SCRIPTS) {
    await uploadFile(client, target, scriptPath, basename(scriptPath));
  }
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  const target = parseUploadTarget(requireEnv('S3_VERSIONS_BUCKET_ENDPOINT'));
  const client = createS3Client(target);

  if (flags.electron) {
    const version = await loadReleaseVersion();
    const releaseFiles = await listReleaseFiles();
    if (releaseFiles.length === 0) {
      throw new Error(`No release files found in ${RELEASE_DIR}`);
    }

    await uploadReleaseFiles(client, target, version, releaseFiles, flags.latest);

    const versionManifest = await buildVersionManifest(version, releaseFiles);
    await uploadText(
      client,
      target,
      buildKey('electron', version, 'manifest.json'),
      versionManifest,
      'application/json'
    );

    if (flags.latest) {
      await uploadText(
        client,
        target,
        buildKey('electron', 'latest', 'manifest.json'),
        versionManifest,
        'application/json'
      );
      await uploadText(
        client,
        target,
        buildKey('electron', 'latest'),
        JSON.stringify({ version }, null, 2),
        'application/json'
      );
    }
  }

  if (flags.script) {
    await uploadInstallerScripts(client, target);
  }
}

await main();
