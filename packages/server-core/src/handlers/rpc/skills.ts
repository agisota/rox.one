import { join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { RPC_CHANNELS, type SkillFile } from '@rox-one/shared/protocol'
import { getWorkspaceByNameOrId } from '@rox-one/shared/config'
import type { RpcServer } from '@rox-one/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { parseId, parseSlug, parseOptionalString } from './_validators'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.skills.GET,
  RPC_CHANNELS.skills.GET_FILES,
  RPC_CHANNELS.skills.DELETE,
  RPC_CHANNELS.skills.OPEN_EDITOR,
  RPC_CHANNELS.skills.OPEN_FINDER,
] as const

export function registerSkillsHandlers(server: RpcServer, deps: HandlerDeps): void {
  // Get all skills for a workspace (and optionally project-level skills from workingDirectory)
  server.handle(RPC_CHANNELS.skills.GET, async (_ctx, workspaceId: unknown, workingDirectory?: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const wd = parseOptionalString('workingDirectory', workingDirectory)
    deps.platform.logger?.info(`SKILLS_GET: Loading skills for workspace: ${wsId}${wd ? `, workingDirectory: ${wd}` : ''}`)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) {
      deps.platform.logger?.error(`SKILLS_GET: Workspace not found: ${wsId}`)
      return []
    }
    // Validate workingDirectory exists on this server — a thin client may pass
    // its local path which doesn't exist on the remote server's filesystem.
    const effectiveWorkingDir = wd && existsSync(wd) ? wd : undefined
    const { loadAllSkills } = await import('@rox-one/shared/skills')
    const skills = loadAllSkills(workspace.rootPath, effectiveWorkingDir)
    deps.platform.logger?.info(`SKILLS_GET: Loaded ${skills.length} skills from ${workspace.rootPath}`)
    return skills
  })

  // Get files in a skill directory
  server.handle(RPC_CHANNELS.skills.GET_FILES, async (_ctx, workspaceId: unknown, skillSlug: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const slug = parseSlug('skillSlug', skillSlug)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) {
      deps.platform.logger?.error(`SKILLS_GET_FILES: Workspace not found: ${wsId}`)
      return []
    }

    const { getWorkspaceSkillsPath } = await import('@rox-one/shared/workspaces')

    const skillsDir = getWorkspaceSkillsPath(workspace.rootPath)
    const skillDir = join(skillsDir, slug)

    function scanDirectory(dirPath: string): SkillFile[] {
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true })
        return entries
          .filter(entry => !entry.name.startsWith('.')) // Skip hidden files
          .map(entry => {
            const fullPath = join(dirPath, entry.name)
            if (entry.isDirectory()) {
              return {
                name: entry.name,
                type: 'directory' as const,
                children: scanDirectory(fullPath),
              }
            } else {
              const stats = statSync(fullPath)
              return {
                name: entry.name,
                type: 'file' as const,
                size: stats.size,
              }
            }
          })
          .sort((a, b) => {
            // Directories first, then files
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
          })
      } catch (err) {
        deps.platform.logger?.error(`SKILLS_GET_FILES: Error scanning ${dirPath}:`, err)
        return []
      }
    }

    return scanDirectory(skillDir)
  })

  // Delete a skill from a workspace
  server.handle(RPC_CHANNELS.skills.DELETE, async (_ctx, workspaceId: unknown, skillSlug: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const slug = parseSlug('skillSlug', skillSlug)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')

    const { deleteSkill } = await import('@rox-one/shared/skills')
    deleteSkill(workspace.rootPath, slug)
    deps.platform.logger?.info(`Deleted skill: ${slug}`)
  })

  // Open skill SKILL.md in editor
  server.handle(RPC_CHANNELS.skills.OPEN_EDITOR, async (_ctx, workspaceId: unknown, skillSlug: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const slug = parseSlug('skillSlug', skillSlug)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')
    if (workspace.remoteServer) throw new Error('Open in editor is not available for remote workspaces')

    const { getWorkspaceSkillsPath } = await import('@rox-one/shared/workspaces')

    const skillsDir = getWorkspaceSkillsPath(workspace.rootPath)
    const skillFile = join(skillsDir, slug, 'SKILL.md')
    await deps.platform.openPath?.(skillFile)
  })

  // Open skill folder in Finder/Explorer
  server.handle(RPC_CHANNELS.skills.OPEN_FINDER, async (_ctx, workspaceId: unknown, skillSlug: unknown) => {
    const wsId = parseId('workspaceId', workspaceId)
    const slug = parseSlug('skillSlug', skillSlug)
    const workspace = getWorkspaceByNameOrId(wsId)
    if (!workspace) throw new Error('Workspace not found')
    if (workspace.remoteServer) throw new Error('Show in Finder is not available for remote workspaces')

    const { getWorkspaceSkillsPath } = await import('@rox-one/shared/workspaces')

    const skillsDir = getWorkspaceSkillsPath(workspace.rootPath)
    const skillDir = join(skillsDir, slug)
    await deps.platform.showItemInFolder?.(skillDir)
  })
}
