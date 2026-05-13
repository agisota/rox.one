/**
 * Workspace conversation persistence (saved messages + token usage) and
 * session-scoped plan storage. Plans are cleared with /clear.
 * Sibling files: storage-io.ts, storage-settings.ts, storage-workspaces.ts,
 * storage-drafts.ts, storage-themes.ts, storage-llm-connections.ts,
 * storage-tool-icons.ts.
 */
import { existsSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { readJsonFileSync } from '../utils/files.ts';
import type { StoredAttachment, StoredMessage } from '@rox-one/core/types';
import type { Plan } from '../agent/plan-types.ts';
import { getWorkspacesDir, ensureWorkspaceDir } from './storage-internal.ts';
import { DEFAULT_LOCAL_SCOPE, type BrandedWorkspaceScope } from './storage-scope.ts';

// Re-export types from core for convenience
export type { StoredAttachment, StoredMessage } from '@rox-one/core/types';

export interface WorkspaceConversation {
  messages: StoredMessage[];
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    contextTokens: number;
    costUsd: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;
  };
  savedAt: number;
}

// Save workspace conversation (messages + token usage)
export function saveWorkspaceConversation(
  workspaceId: string,
  messages: StoredMessage[],
  tokenUsage: WorkspaceConversation['tokenUsage'],
  _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE,
): void {
  const dir = ensureWorkspaceDir(workspaceId, _scope);
  const filePath = join(dir, 'conversation.json');

  const conversation: WorkspaceConversation = {
    messages,
    tokenUsage,
    savedAt: Date.now(),
  };

  try {
    writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
  } catch (e) {
    // Handle cyclic structures or other serialization errors
    console.error(`[storage] [CYCLIC STRUCTURE] Failed to save workspace conversation:`, e);
    console.error(`[storage] Message count: ${messages.length}, message types: ${messages.map(m => m.type).join(', ')}`);
    // Try to save with sanitized messages
    try {
      const sanitizedMessages = messages.map((m, i) => {
        let safeToolInput = m.toolInput;
        if (m.toolInput) {
          try {
            JSON.stringify(m.toolInput);
          } catch (inputErr) {
            console.error(`[storage] [CYCLIC STRUCTURE] in message ${i} toolInput (tool: ${m.toolName}), keys: ${Object.keys(m.toolInput).join(', ')}, error: ${inputErr}`);
            safeToolInput = { error: '[non-serializable input]' };
          }
        }
        return { ...m, toolInput: safeToolInput };
      });
      const sanitizedConversation: WorkspaceConversation = {
        messages: sanitizedMessages,
        tokenUsage,
        savedAt: Date.now(),
      };
      writeFileSync(filePath, JSON.stringify(sanitizedConversation, null, 2), 'utf-8');
      console.error(`[storage] Saved sanitized workspace conversation successfully`);
    } catch (e2) {
      console.error(`[storage] Failed to save even sanitized workspace conversation:`, e2);
    }
  }
}

// Load workspace conversation
export function loadWorkspaceConversation(workspaceId: string, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): WorkspaceConversation | null {
  const filePath = join(getWorkspacesDir(_scope), workspaceId, 'conversation.json');

  try {
    if (!existsSync(filePath)) {
      return null;
    }
    return readJsonFileSync<WorkspaceConversation>(filePath);
  } catch {
    return null;
  }
}

// Get workspace data directory path
export function getWorkspaceDataPath(workspaceId: string, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): string {
  return join(getWorkspacesDir(_scope), workspaceId);
}

// Clear workspace conversation
export function clearWorkspaceConversation(workspaceId: string, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const filePath = join(getWorkspacesDir(_scope), workspaceId, 'conversation.json');
  if (existsSync(filePath)) {
    writeFileSync(filePath, '{}', 'utf-8');
  }

  // Also clear any active plan (plans are session-scoped)
  clearWorkspacePlan(workspaceId, _scope);
}

// ============================================
// Plan Storage (Session-Scoped)
// Plans are stored per-workspace and cleared with /clear
// ============================================

/**
 * Save a plan for a workspace.
 * Plans are session-scoped - they persist during the session but are
 * cleared when the user runs /clear or starts a new session.
 */
export function saveWorkspacePlan(workspaceId: string, plan: Plan, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const dir = ensureWorkspaceDir(workspaceId, _scope);
  const filePath = join(dir, 'plan.json');
  writeFileSync(filePath, JSON.stringify(plan, null, 2), 'utf-8');
}

/**
 * Load the current plan for a workspace.
 * Returns null if no plan exists.
 */
export function loadWorkspacePlan(workspaceId: string, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): Plan | null {
  const filePath = join(getWorkspacesDir(_scope), workspaceId, 'plan.json');

  try {
    if (!existsSync(filePath)) {
      return null;
    }
    return readJsonFileSync<Plan>(filePath);
  } catch {
    return null;
  }
}

/**
 * Clear the plan for a workspace.
 * Called when user runs /clear or cancels a plan.
 */
export function clearWorkspacePlan(workspaceId: string, _scope: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE): void {
  const filePath = join(getWorkspacesDir(_scope), workspaceId, 'plan.json');
  if (existsSync(filePath)) {
    rmSync(filePath);
  }
}
