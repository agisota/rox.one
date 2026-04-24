/**
 * @rox-agent/shared
 *
 * Shared business logic for ROX.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { RoxAgent } from '@rox-agent/shared/agent';
 *   import { loadStoredConfig } from '@rox-agent/shared/config';
 *   import { getCredentialManager } from '@rox-agent/shared/credentials';
 *   import { RoxMcpClient } from '@rox-agent/shared/mcp';
 *   import { debug } from '@rox-agent/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@rox-agent/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@rox-agent/shared/workspaces';
 *
 * Available modules:
 *   - agent: RoxAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Rox API client
 *   - config: Storage, models, preferences
 *   - credentials: Encrypted credential storage
 *   - mcp: MCP client, connection validation
 *   - prompts: System prompt generation
 *   - sources: Workspace-scoped source management (MCP, API, local)
 *   - utils: Debug logging, file handling, summarization
 *   - validation: URL validation
 *   - version: Version and installation management
 *   - workspaces: Workspace management (top-level organizational unit)
 */

// Export branding (standalone, no dependencies)
export * from './branding.ts';
