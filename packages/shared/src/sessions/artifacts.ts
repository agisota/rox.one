/**
 * Session artifact persistence.
 *
 * Artifacts are stored as first-class session content under:
 *   {workspace}/sessions/{sessionId}/artifacts/artifacts.json
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { basename, join } from 'path';
import { randomUUID } from 'crypto';
import { getWorkspaceSessionsPath } from '../workspaces/storage.ts';
import { sanitizeSessionId } from './validation.ts';
import type {
  AgentArtifact,
  AgentArtifactVersion,
  UpsertSessionArtifactInput,
} from './types.ts';

interface ArtifactStore {
  version: 1;
  artifacts: AgentArtifact[];
}

const ARTIFACT_STORE_VERSION = 1;
const ARTIFACTS_DIR = 'artifacts';
const ARTIFACTS_FILE = 'artifacts.json';

export function getSessionArtifactsPath(workspaceRootPath: string, sessionId: string): string {
  return getSessionArtifactsPathFromSessionPath(getSessionPathFromWorkspace(workspaceRootPath, sessionId));
}

export function getSessionArtifactsPathFromSessionPath(sessionPath: string): string {
  return join(sessionPath, ARTIFACTS_DIR);
}

function getSessionPathFromWorkspace(workspaceRootPath: string, sessionId: string): string {
  return join(getWorkspaceSessionsPath(workspaceRootPath), sanitizeSessionId(sessionId));
}

function getArtifactsFilePath(sessionPath: string): string {
  return join(getSessionArtifactsPathFromSessionPath(sessionPath), ARTIFACTS_FILE);
}

function emptyStore(): ArtifactStore {
  return { version: ARTIFACT_STORE_VERSION, artifacts: [] };
}

function readStoreFromSessionPath(sessionPath: string): ArtifactStore {
  const filePath = getArtifactsFilePath(sessionPath);
  if (!existsSync(filePath)) return emptyStore();

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<ArtifactStore> | AgentArtifact[];
    if (Array.isArray(parsed)) {
      return { version: ARTIFACT_STORE_VERSION, artifacts: normalizeArtifacts(parsed) };
    }
    return {
      version: ARTIFACT_STORE_VERSION,
      artifacts: normalizeArtifacts(parsed.artifacts),
    };
  } catch {
    return emptyStore();
  }
}

function normalizeArtifacts(value: unknown): AgentArtifact[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((artifact): artifact is AgentArtifact => isArtifactLike(artifact))
    .map(artifact => ({
      ...artifact,
      versions: Array.isArray(artifact.versions) ? artifact.versions : [],
    }));
}

function isArtifactLike(value: unknown): value is AgentArtifact {
  if (!value || typeof value !== 'object') return false;
  const artifact = value as Partial<AgentArtifact>;
  return (
    typeof artifact.id === 'string' &&
    typeof artifact.conversationId === 'string' &&
    typeof artifact.type === 'string' &&
    typeof artifact.title === 'string' &&
    typeof artifact.content === 'string' &&
    typeof artifact.currentVersionId === 'string' &&
    typeof artifact.createdAt === 'number' &&
    typeof artifact.updatedAt === 'number'
  );
}

function writeStoreToSessionPath(sessionPath: string, store: ArtifactStore): void {
  const dir = getSessionArtifactsPathFromSessionPath(sessionPath);
  mkdirSync(dir, { recursive: true });
  const filePath = getArtifactsFilePath(sessionPath);
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(store, null, 2)}\n`, 'utf-8');
  renameSync(tmpPath, filePath);
}

function slugifyArtifactId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'artifact';
}

function normalizeArtifactId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || `artifact-${randomUUID()}`;
}

function generateArtifactId(input: UpsertSessionArtifactInput): string {
  if (input.id) return normalizeArtifactId(input.id);

  return slugifyArtifactId(input.title);
}

function createVersion(
  artifactId: string,
  input: UpsertSessionArtifactInput,
  createdAt: number,
): AgentArtifactVersion {
  return {
    id: input.versionId ?? randomUUID(),
    artifactId,
    content: input.content,
    createdAt,
    title: input.title,
    type: input.type,
    sourceMessageId: input.sourceMessageId,
    metadata: input.metadata,
  };
}

export function listSessionArtifacts(workspaceRootPath: string, sessionId: string): AgentArtifact[] {
  return listSessionArtifactsFromPath(getSessionPathFromWorkspace(workspaceRootPath, sessionId));
}

export function listSessionArtifactsFromPath(sessionPath: string): AgentArtifact[] {
  return readStoreFromSessionPath(sessionPath).artifacts;
}

export function getSessionArtifact(
  workspaceRootPath: string,
  sessionId: string,
  artifactId: string,
): AgentArtifact | null {
  return getSessionArtifactFromPath(getSessionPathFromWorkspace(workspaceRootPath, sessionId), artifactId);
}

export function getSessionArtifactFromPath(sessionPath: string, artifactId: string): AgentArtifact | null {
  const safeArtifactId = normalizeArtifactId(artifactId);
  return listSessionArtifactsFromPath(sessionPath).find(artifact => artifact.id === safeArtifactId) ?? null;
}

export async function upsertSessionArtifact(
  workspaceRootPath: string,
  sessionId: string,
  input: UpsertSessionArtifactInput,
): Promise<AgentArtifact> {
  return upsertSessionArtifactInPath(getSessionPathFromWorkspace(workspaceRootPath, sessionId), {
    ...input,
    conversationId: input.conversationId ?? sessionId,
  });
}

export async function upsertSessionArtifactInPath(
  sessionPath: string,
  input: UpsertSessionArtifactInput,
): Promise<AgentArtifact> {
  const store = readStoreFromSessionPath(sessionPath);
  const now = input.now ?? Date.now();
  const conversationId = input.conversationId ?? basename(sessionPath);
  const artifactId = generateArtifactId(input);
  const version = createVersion(artifactId, input, now);
  const existingIndex = store.artifacts.findIndex(artifact => artifact.id === artifactId);

  let artifact: AgentArtifact;
  if (existingIndex >= 0) {
    const previous = store.artifacts[existingIndex]!;
    artifact = {
      ...previous,
      conversationId,
      type: input.type,
      title: input.title,
      content: input.content,
      currentVersionId: version.id,
      updatedAt: now,
      sourceMessageId: input.sourceMessageId ?? previous.sourceMessageId,
      metadata: input.metadata ?? previous.metadata,
      versions: [...previous.versions, version],
    };
    store.artifacts[existingIndex] = artifact;
  } else {
    artifact = {
      id: artifactId,
      conversationId,
      type: input.type,
      title: input.title,
      content: input.content,
      currentVersionId: version.id,
      createdAt: now,
      updatedAt: now,
      sourceMessageId: input.sourceMessageId,
      metadata: input.metadata,
      versions: [version],
    };
    store.artifacts.push(artifact);
  }

  writeStoreToSessionPath(sessionPath, store);
  return artifact;
}

export function deleteSessionArtifact(
  workspaceRootPath: string,
  sessionId: string,
  artifactId: string,
): boolean {
  return deleteSessionArtifactFromPath(getSessionPathFromWorkspace(workspaceRootPath, sessionId), artifactId);
}

export function deleteSessionArtifactFromPath(sessionPath: string, artifactId: string): boolean {
  const store = readStoreFromSessionPath(sessionPath);
  const safeArtifactId = normalizeArtifactId(artifactId);
  const nextArtifacts = store.artifacts.filter(artifact => artifact.id !== safeArtifactId);
  if (nextArtifacts.length === store.artifacts.length) return false;

  if (nextArtifacts.length === 0) {
    rmSync(getArtifactsFilePath(sessionPath), { force: true });
  } else {
    writeStoreToSessionPath(sessionPath, { ...store, artifacts: nextArtifacts });
  }
  return true;
}
