# Decision 0002: config/storage.ts Decomposition

- Status: accepted
- Date: 2026-05-09

## Canonical

The 2935-LOC `packages/shared/src/config/storage.ts` is split into nine concern-scoped modules. The original file is retained as a barrel re-export so callers across the repo do not change.

```text
packages/shared/src/config/
  storage.ts                  14 LOC  // barrel: export * from each sub-module
  storage-internal.ts         33 LOC  // private helpers shared across siblings
  storage-tool-icons.ts       55 LOC
  storage-conversations.ts   152 LOC
  storage-drafts.ts          177 LOC
  storage-workspaces.ts      271 LOC
  storage-themes.ts          287 LOC
  storage-io.ts              309 LOC  // load/save/clear/migrate StoredConfig
  storage-settings.ts        454 LOC  // 18+ named getter/setter pairs
  storage-llm-connections.ts 1277 LOC // largest concern; warrants its own
```

## Why

- **The 2935-LOC original mixed eight independent concerns.** Each had its own data model, its own persistence path, and its own consumer set. A change to one (e.g., LLM-connection serialization) forced a reader to scan 2935 LOC to be sure they weren't breaking another (e.g., theme storage).
- **The barrel preserves the public API.** `export * from './storage-<concern>.ts'` keeps every imported symbol available at the original `'@craft-agent/shared/config/storage'` path. Callers across the repo are unchanged. This is honest indirection, not a backwards-compatibility hack — the barrel is the new home of the module's public surface.
- **`storage-internal.ts` exists** because four functions (`getConfigFile`, `getConfigDefaultsFile`, `getWorkspacesDir`, `ensureWorkspaceDir`) were originally module-private but are now needed by sibling sub-modules. Promoting them to exports is required by the split; keeping them in their own module makes "this is internal to the storage cluster" legible.
- **`storage-llm-connections.ts` is large (1277 LOC) on purpose.** LLM-connection serialization has its own schema migrations, model-resolution rules, and per-provider fallbacks; splitting it further would break logical cohesion. Each other sub-module is < 500 LOC.

## Out of scope

- **Tenancy contracts.** The Slice 3 plan (`docs/superpowers/specs/...`) calls for a `WorkspaceScope` parameter on every persistence call. That sweep touches every named setting getter/setter and every workspace function — a separate commit (and a separate ADR if the contract evolves) once the sub-modules have settled.
- **Caller migration off the barrel.** The barrel is intentional and stable. Callers may continue to import from `'@craft-agent/shared/config/storage'`. If a caller wants the smaller blast-radius of a sub-module's symbols, they can import from `'@craft-agent/shared/config/storage-<concern>'` directly — both paths resolve identically.
- **Behavioral fixes.** Five tests in `resource-bundle.test.ts > exportResources` fail in the full `bun test` suite but pass when run in isolation. The 5-fail count predates this decomposition (verified by stashing the split and running the baseline). They reflect a pre-existing test-order pollution problem — separate concern, separate fix.
