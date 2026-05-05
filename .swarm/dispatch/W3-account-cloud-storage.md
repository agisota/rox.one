# Dispatch Packet: W3 Account, Cloud, Storage, Sync

Phase: `EXECUTE`

Tickets: `T017`-`T025`

## Objective

Close the gap between the existing in-memory/fake account-cloud-storage core and a coherent tested application layer: personal cabinet, auth boundary, ledger/events, teams, quotas, managed workspaces, explicit sync, and Sync V2 design follow-through.

## Current Evidence

Most modules and tests already exist, but the audit classified the tickets as `PARTIAL_CORE` because durable/provider wiring, UI acceptance, and some cloud-wide boundary application remain incomplete.

Relevant modules include:

- `packages/server-core/src/webui/account-cabinet.ts`
- `packages/server-core/src/webui/account-ledger.ts`
- `packages/server-core/src/webui/account-events.ts`
- `packages/server-core/src/webui/account-session-boundary.ts`
- `packages/server-core/src/webui/account-teams.ts`
- `packages/server-core/src/storage/object-storage.ts`
- `packages/server-core/src/webui/account-cloud-workspaces.ts`
- `packages/server-core/src/sync/local-cloud-sync.ts`
- `docs/architecture/sync-v2-design.md`

## Dependency Order

1. `T020` auth boundary must be applied to future cloud APIs.
2. `T017` account cabinet endpoint/UI contract must match actual account state.
3. `T018`, `T019`, `T021`, and `T022` can proceed in parallel after `T017/T020` are stable.
4. `T023` depends on auth boundary and account/team stores.
5. `T024` depends on storage quotas plus managed workspaces.
6. `T025` depends on explicit sync MVP evidence.

## Write Scope

- `packages/server-core/src/webui/**`
- `packages/server-core/src/accounts/**`
- `packages/server-core/src/storage/**`
- `packages/server-core/src/sync/**`
- `packages/server/src/**` only for wiring existing adapters
- `apps/electron/src/renderer/pages/settings/**` only for account-cabinet UI acceptance
- matching tests and worklogs/tickets for `T017`-`T025`

## Forbidden Scope

- No real payment provider calls.
- No real S3/MinIO calls in tests.
- No real email or OAuth provider calls.
- No silent overwrite in sync.
- No cross-tenant reads.

## Required TDD

- Unit tests for any durable adapter contracts.
- HTTP tests for auth/session boundary and team/workspace access.
- Security tests for cross-user/cross-team denial.
- Quota tests for storage capacity and path traversal.
- Sync tests for conflict detection and no silent overwrite.
- UI tests for account cabinet state truth when login refresh succeeds/fails.

## Validation Commands

- `bun test packages/server-core/src/webui/__tests__/account-http.test.ts packages/server-core/src/webui/__tests__/account-cabinet.test.ts`
- `bun test packages/server-core/src/webui/__tests__/account-ledger.test.ts packages/server-core/src/webui/__tests__/account-events.test.ts packages/server-core/src/webui/__tests__/account-teams.test.ts`
- `bun test packages/server-core/src/storage/__tests__/object-storage.test.ts packages/server-core/src/sync/__tests__/local-cloud-sync.test.ts`
- `cd packages/server-core && bun run typecheck`
- `bun run typecheck:electron` when settings UI changes
- `bun run validate:agent-contract`
- `git diff --check`

## Acceptance

- Account cabinet reflects authentication truth and does not show stale `Authentication required` after successful refresh.
- Ledger/events have deterministic fake/durable seams and do not leak secrets.
- Team/RBAC routes deny by default and preserve viewer/member/admin/owner semantics.
- Storage quotas and tenant prefixes are enforced before writes.
- Managed workspaces have owner/team visibility and storage prefixes.
- Sync MVP requires explicit push/pull and conflict approval.
- Sync V2 design is backed by validation and follow-up implementation tasks where not implemented.
