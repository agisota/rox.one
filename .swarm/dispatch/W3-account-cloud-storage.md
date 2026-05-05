# Dispatch Packet: W3 Account, Cloud, Storage, Sync

Phase: `VERIFY`

Tickets: `T017`-`T025`

## Objective

Keep the account/cloud/storage/sync MVP contracts coherent and verified: personal cabinet, auth boundary, ledger/events, teams, quotas, managed workspaces, explicit sync, and Sync V2 design follow-through.

## Current Evidence

The lane is closed as an MVP-contract lane after fresh account/cloud/storage validation. Durable/provider wiring remains a documented production follow-up, not a blocker for these fake-provider-safe tickets.

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

1. `T017` account cabinet truth is closed.
2. `T018`-`T023` are closed after the combined `52 pass` account/cloud/storage gate.
3. `T024` is closed after explicit sync API/service and Electron smoke evidence.
4. `T025` is closed as a validated design contract.
5. Future durable/provider work must open new tickets instead of reopening these MVP contracts.

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

Status: `DONE` for T017-T025 MVP scope. Known production risks: durable persistence, real MinIO/S3 provider wiring, atomic quota reservations, and multi-writer sync leases.
