# Data contract: User + Identity (WT-04)

**Status:** Implemented (Wave 0)
**Spec:** [`docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md`](../superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md)
**Feature flag:** `rox.feature.contracts.user-v1` (default OFF)
**Date:** 2026-05-21

## Summary

WT-04 lays the foundational data contract that every downstream
Auth / RBAC / Storage / Agent-Fabric / Source work-track imports. It has
three artifact families:

1. **Zod schemas** — `UserSchema`, `IdentitySchema`, `UuidV7Schema` in
   `packages/shared/src/core/`. These are the single source of truth for
   shape, defaults, and validation rules.
2. **Repositories** — `UserRepository`, `IdentityRepository` in
   `packages/server-core/src/services/`. Result-based (`Ok<T> | Err<E>`),
   never throw on expected misses, parse input AND output through Zod, and
   emit five audit event types.
3. **Postgres migrations** — `2026-05-21-user-identity-{up,down}.sql` in
   `packages/server-core/src/persistence/migrations/`. Up creates `users`
   and `identities`; down reverses idempotently. CI runs round-trip.

## Domain model

```
              ┌──────────────┐
              │   tenants    │  (WT-05; FK target)
              │              │
              └──────┬───────┘
                     │  tenant_id
                     ▼
              ┌──────────────┐                ┌──────────────┐
              │    users     │ 1            n │  identities  │
              │              ├────────────────┤              │
              │  id          │      user_id   │  id          │
              │  tenant_id   │                │  user_id     │
              │  email       │                │  tenant_id   │
              │  username?   │                │  provider    │
              │  display_name│                │  external_id │
              │  status      │                │  claims JSONB│
              │  …           │                │  primary     │
              └──────────────┘                │  last_seen   │
                                              └──────────────┘
```

- **User** = one human, one row, scoped per tenant.
- **Identity** = federated provider link (Google, Slack, Microsoft,
  Anthropic OAuth, SCIM external_id, or `rox-local` for offline/test).
- A user may have many identities; each identity belongs to exactly one
  user (account-merge re-points `user_id`, never duplicates the row).

## Design decisions

### UUID v7

RFC 9562 — 48-bit ms timestamp + 4-bit version + 12-bit random + 2-bit
variant + 62-bit random. Lower-case hyphenated form. Time-sortable and
B-tree friendly per the engineering rule. Generated in application JS
because Postgres native `gen_random_uuid()` only emits v4 until PG17.

A parallel hand-roll exists at
`packages/server-core/src/persistence/sqlite/uuid-v7.ts` for the M.6
sqlite persistence layer. Both implementations are byte-compatible; they
live in independent packages to avoid a cross-package import cycle.

### `DEFAULT_TENANT_ID` backfill

While `rox.feature.contracts.tenant-v1` is OFF (WT-05 lands in parallel),
single-tenant data backfills with the well-known UUID v7
`01900000-0000-7000-8000-000000000000`. `UserRepository.create()`
auto-injects this when the caller did not pass `tenantId`. When the
tenant-v1 flag flips ON the constant becomes a real `tenants.id` row.

### `claims` JSONB cap (16 KB)

Real-world JWT payloads land at ~3 KB (Anthropic OAuth) and ~5 KB (SCIM).
The 16 KB cap gives 3× headroom and prevents DoS via massive provider
payloads. Enforced at two layers:

- Zod `superRefine` in `IdentitySchema.claims`
- Postgres `CHECK (length(claims::text) <= 16384)`

If SCIM custom attributes ever overflow, the escape hatch is a
side-table `identity_extended_claims` (deferred to a future WT).

### Result-based repositories

`Result<T, RepositoryError>` is `{ ok: true; value } | { ok: false; error }`.
Expected misses (`not-found`, `duplicate`, `invalid-input`) are returned
as `Err`; only programmer errors throw. This matches the engineering
preference for explicit failure modes and makes the contract easy to
consume from `async`/`await` and synchronous code alike.

### Audit shim (5 event types)

The two repositories together emit:

| Event              | Source repo          | Emitted on          |
|--------------------|----------------------|---------------------|
| `user.created`     | `UserRepository`     | `create()`          |
| `user.updated`     | `UserRepository`     | `update()`          |
| `user.soft-deleted`| `UserRepository`     | `softDelete()`      |
| `identity.linked`  | `IdentityRepository` | `create()`, `linkToUser()` |
| `identity.unlinked`| `IdentityRepository` | `unlinkFromUser()`  |

`user.restored` is emitted as a bonus on `restore()` but is **not** counted
in the AC-04.8 five-event minimum. Email is logged as a short FNV-1a hash
(`hashEmailForAudit`) — raw email never appears in the audit payload
(NFR-04.2).

## Public API surface

```ts
// Schemas + types
import {
  DEFAULT_TENANT_ID,
  IdentitySchema,
  IdentityProviderSchema,
  IDENTITY_CLAIMS_MAX_BYTES,
  UserSchema,
  UserStatusSchema,
  UuidV7Schema,
  uuidV7,
  type Identity,
  type User,
} from '@rox-one/shared/core';

// Repositories (consumed by Auth WTs)
import {
  UserRepository,
  hashEmailForAudit,
  type UserAuditEvent,
  type Result,
  type RepositoryError,
} from '../services/user-repository.ts';

import {
  IdentityRepository,
  type IdentityAuditEvent,
} from '../services/identity-repository.ts';
```

## Feature flag gate

`rox.feature.contracts.user-v1` is OFF by default. Contracts and types
are always importable; only `register()` on each repository is no-op'd
when the flag is OFF. WT-10..18 cannot bind to the global service
container before Foundation Cut.

Registry entry lives in `packages/shared/src/feature-flags/registry.ts`
(WT-07). Adding the entry is a scaffold-extension request outside the
WT-04 file allowlist.

## Open issues handed to downstream WTs

- WT-05 (tenant): replace `DEFAULT_TENANT_ID` backfill with real
  `tenants.id` FK.
- WT-07 (feature-flags): register `rox.feature.contracts.user-v1` and
  `rox.feature.contracts.tenant-v1` in `feature-flags/registry.ts`.
- WT-08 (audit): wire the repository `auditSink` to the real audit pipeline.
- WT-10 (Access JWT): assert `sub` claim → `User.id`.
- WT-11 (SCIM): provision identities through `IdentityRepository.create`.
- WT-13 (username): enforce username uniqueness policy (per-tenant or global).
- WT-27 (soft-delete versioning): cron-job grace cleanup of `deleted_at_utc`.

## Postgres exports / package.json note

Because WT-00 owns `package.json` and `tsconfig.json`, the subpath export
`./core` is **not** added to `packages/shared/package.json` in this PR.
TS path resolution covers typecheck (`@rox-one/shared/*` →
`../shared/src/*`), and bun runtime resolves relative imports inside the
monorepo. Adding the explicit `./core` export entry is a scaffold-extension
request tracked in the WT-04 PR body.
