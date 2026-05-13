# C4 Multi-Tenant Storage Isolation Context

## Task Statement

Implement the C4 multi-tenant storage isolation slice end-to-end from the merged design and implementation plan on `origin/main`.

## Desired Outcome

- Land branded `WorkspaceScope` production through `DEFAULT_LOCAL_SCOPE` and `deriveScopeFromAuth`.
- Preserve the flat single-user on-disk layout by default.
- Gate tenant-prefixed storage paths behind `ROX_MULTI_TENANT=1`.
- Wire one `packages/server-core/src/handlers/rpc/workspace.ts` handler through the auth-derived scope path.
- Demonstrate the five C4 invariants with tests and complete ticket/worklog evidence.

## Known Facts / Evidence

- `git pull --ff-only origin main` succeeded on 2026-05-13.
- `AGENTS.md` requires ticket-first, worklog-first, TDD-first implementation and composable commits.
- Design spec: `docs/superpowers/specs/2026-05-10-c4-multi-tenant-storage-isolation-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-05-10-c4-multi-tenant-storage-isolation.md`.
- Predecessor ADR: `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`.
- Current `DEFAULT_LOCAL_SCOPE` is defined in `packages/shared/src/config/storage-scope.ts`.
- Current `storage-internal.ts` uses `getConfigDir()` directly for all path helpers.

## Constraints

- Do not change the single-user flat layout.
- Do not touch C4 out-of-scope runtime files, especially `apps/electron/src/main/handlers/*`.
- Do not export the private brand symbol or the brand applier.
- Do not add production dependencies.
- Stay within the design spec component list unless a ticket is written and work pauses for human review.
- Use tests first and commit logical slices with the Lore commit protocol.

## Unknowns / Open Questions

- Exact logger import and observable logging API in shared config.
- Exact webui RPC handler context shape for `ctx.session` and `ctx.workspaceId`.
- Exact caller migration set after narrowing storage submodule signatures.

## Likely Codebase Touchpoints

- `packages/shared/src/config/storage-scope.ts`
- `packages/shared/src/config/storage-scope-auth.ts`
- `packages/shared/src/config/storage-scope-runtime.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/storage.ts`
- `packages/shared/src/config/storage-{io,settings,workspaces,conversations,drafts,themes,llm-connections,tool-icons}.ts`
- `packages/shared/src/config/__tests__/storage-scope*.test.ts`
- `packages/server-core/src/handlers/rpc/workspace.ts`
- `packages/server-core/src/handlers/rpc/__tests__/workspace-scope.test.ts`
- `docs/decision-records/audit-harness/0005-storage-tenancy-contract.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
