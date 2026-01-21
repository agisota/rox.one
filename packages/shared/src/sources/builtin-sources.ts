/**
 * Built-in Sources
 *
 * System-level sources that are always available in every workspace.
 * These sources are not shown in the sources list UI but are available
 * for the agent to use.
 *
 * NOTE: rox-agents-docs is now an always-available MCP server configured
 * directly in rox-agent.ts, not a source. This file is kept for backwards
 * compatibility but returns empty results.
 */

import type { LoadedSource, FolderSourceConfig } from './types.ts';

/**
 * Get all built-in sources for a workspace.
 *
 * Currently returns empty array - rox-agents-docs has been moved to
 * an always-available MCP server in rox-agent.ts.
 *
 * @param _workspaceId - The workspace ID (unused)
 * @param _workspaceRootPath - Absolute path to workspace root folder (unused)
 * @returns Empty array (no built-in sources)
 */
export function getBuiltinSources(_workspaceId: string, _workspaceRootPath: string): LoadedSource[] {
  return [];
}

/**
 * Get the built-in Rox Agents docs source.
 *
 * @deprecated rox-agents-docs is now an always-available MCP server
 * configured directly in rox-agent.ts. This function is kept for
 * backwards compatibility but returns a placeholder.
 */
export function getDocsSource(workspaceId: string, workspaceRootPath: string): LoadedSource {
  // Return a placeholder - this shouldn't be called anymore
  const placeholderConfig: FolderSourceConfig = {
    id: 'builtin-rox-agents-docs',
    name: 'Rox Agents Docs',
    slug: 'rox-agents-docs',
    enabled: false,
    provider: 'mintlify',
    type: 'mcp',
    mcp: {
      transport: 'http',
      url: 'https://agents.rox.do/docs/mcp',
      authType: 'none',
    },
    tagline: 'Search Rox Agents documentation and source setup guides',
    icon: '📚',
    isAuthenticated: true,
    connectionStatus: 'connected',
  };

  return {
    workspaceId,
    workspaceRootPath,
    folderPath: '',
    config: placeholderConfig,
    guide: { raw: '' },
    isBuiltin: true,
  };
}

/**
 * Check if a source slug is a built-in source.
 *
 * Returns false - rox-agents-docs is now an always-available MCP server,
 * not a source in the sources system.
 *
 * @param _slug - Source slug to check (unused)
 * @returns false (no built-in sources)
 */
export function isBuiltinSource(_slug: string): boolean {
  return false;
}
