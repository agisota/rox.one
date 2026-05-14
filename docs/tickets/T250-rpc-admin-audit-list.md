# T250-rpc — admin RPC audit.list handler (FULL REDO)
Status: DONE
Phase: M.14

## Why FULL REDO

The prior attempt branch (`feat/M14-T250rpc-audit-query`) was rejected before
landing. Diffing the branch against `origin/main` shows it never recorded a
delta — the working tree had only branch metadata. This redo closes the
gaps the previous spec identified:

- **No opaque cursor.** The earlier sketch leaned on naked `limit`/`offset`
  numerics, which forces clients to expose record positions and cannot
  cope with two records sharing a timestamp. This redo encodes
  `{ts, eventId}` as a URL-safe base64 cursor — opaque on the wire and
  stable across same-`ts` records.
- **Owner gate was bespoke.** This redo reuses
  `rbacResolver.ownerGrantsForUser` (the same call used by
  `roles.create`'s global-owner check and `missions.ts`' workspace-owner
  check). No new auth code, no parallel auth surface.
- **No store-error wrapping.** This redo catches every failure from the
  M.1.5 store (`AuditEventStorageBackend.listRecords`) and surfaces a
  stable `{error: 'audit-store-error'}` envelope, so raw SQL / file
  paths cannot leak to the renderer.
- **Schema was permissive.** This redo uses Zod `.strict()` at every
  nesting level, with explicit `int()`/`min(1)`/`max(100)` on `limit`
  and `.datetime()` on `since` / `until`. Unknown fields are rejected;
  zero/200 / non-integer / non-ISO inputs return
  `{error: 'invalid-argument', reason: 'invalid-<path>'}`.

## Surface

- **New handler** `packages/server-core/src/handlers/rpc/admin/audit-list.ts`
  registers a single channel `RPC_CHANNELS.audit.LIST` (`'audit.list'`).
- **Owner-gate**: global-owner only — audit records are cross-workspace
  and cross-tenant, so workspace-owner is intentionally insufficient.
- **Optional dep**: `HandlerDeps.auditEventStore?: AuditEventStorageBackend`.
  Hosts without M.1.5 wiring respond `{error: 'audit-not-configured'}`.
- **Channel routing**: classified `REMOTE_ELIGIBLE` because audit logs
  live with the server that owns the workspace data.

## Contract

Input (Zod, strict):

```ts
{
  cursor?: string,                  // opaque, base64url of {ts, eventId}
  limit?: number,                   // int, 1..100, default 25
  filter?: {
    action?: string,                // eventType equality
    actor?: string,                 // actor.id equality
    since?: string,                 // ISO-8601 inclusive lower bound
    until?: string,                 // ISO-8601 inclusive upper bound
  },
}
```

Output (happy path):

```ts
{ ok: true, entries: AuditEventRecord[], nextCursor: string | null, totalCount: number }
```

Sort order: most recent first (`ts DESC, eventId DESC`).
`totalCount` reflects filter matches across the whole store — not the cursor window.

Error envelopes (structured, no raw errors leak):

| `error`                  | `reason`                  | When                                          |
|--------------------------|---------------------------|-----------------------------------------------|
| `permission-denied`      | `no-user`                 | unauthenticated caller                        |
| `permission-denied`      | `no-owner-grant`          | caller lacks `global` owner grant             |
| `rbac-not-configured`    | `no-rbac-resolver`        | host omitted the RBAC resolver                |
| `audit-not-configured`   | `no-audit-event-store`    | host omitted the M.1.5 store                  |
| `invalid-argument`       | `invalid-<path>`          | Zod rejection — `limit`, `filter.since`, etc. |
| `audit-store-error`      | `list-records-failed`     | `listRecords()` threw — error wrapped         |

## Validation

- `bun test packages/server-core/src/handlers/rpc/admin/__tests__/audit-list.test.ts` — passes (24 cases)
- `bun run typecheck` (server-core) — passes
- `validate:roadmap` — passes

## Follow-ups

- **T232c** — renderer-side `AuditEventSource` adapter that maps
  `AuditEventRecord` → the `AuditEvent` shape consumed by
  `AuditLogPanel`. Out of scope here.
- **T250-rpc-perf** — index pushdown for substring `actorQuery` /
  payload search when a sqlite-backed store is wired (T247).
