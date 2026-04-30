import { realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, normalize, relative, resolve } from 'node:path'

export type FileManagerScopeKind = 'workspace' | 'working-directory' | 'session-attachments'

export interface FileManagerScope {
  id: string
  kind: FileManagerScopeKind
  label: string
  rootPath: string
  writable: boolean
}

export interface BuildFileManagerScopesInput {
  workspaceId: string
  workspaceRoot?: string | null
  workingDirectory?: string | null
  sessionAttachmentsRoot?: string | null
}

export interface FileManagerPathValidationResult {
  absolutePath: string
  scopeId: string
  scopeKind: FileManagerScopeKind
}

function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/')
    ? path.replace(/^~/, homedir())
    : path
}

function normalizeScopeRoot(path: string): string | null {
  const normalized = normalize(expandHome(path))
  return isAbsolute(normalized) ? normalized : null
}

function isInsideScope(candidatePath: string, scopeRoot: string): boolean {
  const rel = relative(scopeRoot, candidatePath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function isSensitivePath(path: string): boolean {
  const sensitivePatterns = [
    /\.ssh[\\/]/,
    /\.gnupg[\\/]/,
    /\.aws[\\/]credentials/,
    /\.env$/,
    /\.env\./,
    /credentials\.json$/,
    /secrets?\./i,
    /\.pem$/,
    /\.key$/,
  ]

  return sensitivePatterns.some(pattern => pattern.test(path))
}

export function buildFileManagerScopes(input: BuildFileManagerScopesInput): FileManagerScope[] {
  const candidates: Array<Omit<FileManagerScope, 'rootPath'> & { rootPath?: string | null }> = [
    {
      id: `workspace:${input.workspaceId}`,
      kind: 'workspace',
      label: 'Workspace',
      rootPath: input.workspaceRoot,
      writable: true,
    },
    {
      id: `working-directory:${input.workspaceId}`,
      kind: 'working-directory',
      label: 'Working directory',
      rootPath: input.workingDirectory,
      writable: true,
    },
    {
      id: `session-attachments:${input.workspaceId}`,
      kind: 'session-attachments',
      label: 'Session attachments',
      rootPath: input.sessionAttachmentsRoot,
      writable: true,
    },
  ]

  const scopes: FileManagerScope[] = []
  const seenRoots = new Set<string>()

  for (const candidate of candidates) {
    if (!candidate.rootPath) continue

    const rootPath = normalizeScopeRoot(candidate.rootPath)
    if (!rootPath || seenRoots.has(rootPath)) continue

    seenRoots.add(rootPath)
    scopes.push({
      ...candidate,
      rootPath,
    })
  }

  return scopes
}

export async function validateFileManagerPathForScopes(
  filePath: string,
  scopes: FileManagerScope[],
): Promise<FileManagerPathValidationResult> {
  if (scopes.length === 0) {
    throw new Error('Access denied: no file manager scopes are available')
  }

  const normalizedPath = normalize(expandHome(filePath))
  if (!isAbsolute(normalizedPath)) {
    throw new Error('Only absolute file paths are allowed')
  }

  const absolutePath = resolve(normalizedPath)
  const realFilePath = await realpath(absolutePath).catch(() => absolutePath)

  if (isSensitivePath(realFilePath)) {
    throw new Error('Access denied: cannot browse sensitive files')
  }

  for (const scope of scopes) {
    const realScopeRoot = await realpath(scope.rootPath).catch(() => scope.rootPath)
    if (isInsideScope(realFilePath, realScopeRoot)) {
      return {
        absolutePath: realFilePath,
        scopeId: scope.id,
        scopeKind: scope.kind,
      }
    }
  }

  throw new Error('Access denied: file path is outside file manager scopes')
}
