/**
 * Barrel for the config/storage module.
 * Slice 3 / decomposition 1: the original 2935-LOC storage.ts has been split
 * into concern-scoped sub-modules. This barrel preserves the original public
 * API exactly — callers continue to import from './config/storage'.
 */
export * from './storage-scope.ts';
export * from './storage-io.ts';
export * from './storage-settings.ts';
export * from './storage-workspaces.ts';
export * from './storage-conversations.ts';
export * from './storage-drafts.ts';
export * from './storage-themes.ts';
export * from './storage-llm-connections.ts';
export * from './storage-tool-icons.ts';
