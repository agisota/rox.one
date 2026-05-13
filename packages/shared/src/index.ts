/**
 * @rox-one/shared
 *
 * Shared business logic for ROX.
 * Used by the Electron app.
 *
 * Import specific modules via subpath exports:
 *   import { CraftAgent } from '@rox-one/shared/agent';
 *   import { loadStoredConfig } from '@rox-one/shared/config';
 *   import { getCredentialManager } from '@rox-one/shared/credentials';
 *   import { RoxMcpClient } from '@rox-one/shared/mcp';
 *   import { debug } from '@rox-one/shared/utils';
 *   import { loadSource, createSource, getSourceCredentialManager } from '@rox-one/shared/sources';
 *   import { createWorkspace, loadWorkspace } from '@rox-one/shared/workspaces';
 *
 * Available modules:
 *   - agent: CraftAgent SDK wrapper, plan tools
 *   - auth: OAuth, token management, auth state
 *   - clients: Craft API client
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
