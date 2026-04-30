import { describe, expect, it } from 'bun:test'
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildFileManagerScopes,
  validateFileManagerPathForScopes,
} from '../file-manager-scopes'

async function makeTempRoot(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

describe('file manager scopes', () => {
  it('builds deduped workspace scopes without adding broad home or tmp access', () => {
    const workspaceRoot = join(tmpdir(), 'rox-workspace')
    const workingDirectory = join(workspaceRoot, 'project')

    const scopes = buildFileManagerScopes({
      workspaceId: 'workspace-1',
      workspaceRoot,
      workingDirectory,
      sessionAttachmentsRoot: workspaceRoot,
    })

    expect(scopes.map(scope => scope.kind)).toEqual(['workspace', 'working-directory'])
    expect(scopes[0]).toMatchObject({
      id: 'workspace:workspace-1',
      label: 'Workspace',
      rootPath: workspaceRoot,
      writable: true,
    })
    expect(scopes[1]).toMatchObject({
      id: 'working-directory:workspace-1',
      label: 'Working directory',
      rootPath: workingDirectory,
      writable: true,
    })
  })

  it('allows paths inside a declared scope and denies sibling paths', async () => {
    const workspaceRoot = await makeTempRoot('rox-fm-workspace-')
    const siblingRoot = await makeTempRoot('rox-fm-sibling-')
    const filePath = join(workspaceRoot, 'notes.md')
    const siblingPath = join(siblingRoot, 'notes.md')
    await writeFile(filePath, 'ok')
    await writeFile(siblingPath, 'no')

    const scopes = buildFileManagerScopes({
      workspaceId: 'workspace-1',
      workspaceRoot,
    })

    const result = await validateFileManagerPathForScopes(filePath, scopes)
    expect(result).toMatchObject({
      scopeId: 'workspace:workspace-1',
    })
    expect(result.absolutePath.endsWith('/notes.md')).toBe(true)
    await expect(validateFileManagerPathForScopes(siblingPath, scopes)).rejects.toThrow('outside file manager scopes')
  })

  it('rejects sensitive files inside an otherwise allowed scope', async () => {
    const workspaceRoot = await makeTempRoot('rox-fm-sensitive-')
    const envPath = join(workspaceRoot, '.env')
    await writeFile(envPath, 'SECRET=1')

    const scopes = buildFileManagerScopes({
      workspaceId: 'workspace-1',
      workspaceRoot,
    })

    await expect(validateFileManagerPathForScopes(envPath, scopes)).rejects.toThrow('sensitive')
  })

  it('rejects symlinks that escape the declared scope', async () => {
    const workspaceRoot = await makeTempRoot('rox-fm-symlink-workspace-')
    const externalRoot = await makeTempRoot('rox-fm-symlink-external-')
    const externalFile = join(externalRoot, 'outside.txt')
    const linkPath = join(workspaceRoot, 'outside-link.txt')
    await writeFile(externalFile, 'outside')

    try {
      await symlink(externalFile, linkPath)
    } catch {
      return
    }

    const scopes = buildFileManagerScopes({
      workspaceId: 'workspace-1',
      workspaceRoot,
    })

    await expect(validateFileManagerPathForScopes(linkPath, scopes)).rejects.toThrow('outside file manager scopes')
  })
})
