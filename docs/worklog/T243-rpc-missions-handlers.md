# T243-rpc worklog — Mission admin RPC handlers (create / dispatchEvent / get / list)

## 1. Goal

Layer the admin RPC surface on top of the M.8 mission kernel that
T241 (PR #88) and T246 (PR #99) shipped. Renderer code needs to be
able to mint, drive, read, and list missions over the WS-based IPC
transport so the upcoming Mission Console UI can subscribe to live
state. T243-rpc adds the four handlers; T244-rpc (follow-up) will
add the typed renderer client.

## 2. Why the suffix?

The repository already owns:

- `T243-rbac-property-based-scope-forgery-tests.md` (M.13 security)
- `T244-schema-reservation-asterisk.md` (M.0 schema reservation)

Re-using either numeric id would collide. The `T243-rpc` hyphenated
suffix keeps the new slice clearly tied to M.8 mission work without
stomping on existing tickets, and the validator (which keys on the
`T###-...` prefix only) still accepts the filename.

## 3. Approach

Minimal-surface wiring:

1. **Channels** — add `RPC_CHANNELS.missions.{create,
   dispatchEvent, get, list}` to `channels.ts`; classify all four as
   REMOTE_ELIGIBLE in `routing.ts` (the scheduler runs on whichever
   server owns the workspace).
2. **HandlerDeps** — add optional `missionScheduler?: MissionScheduler`
   field. Hosts that have not adopted M.8 may omit it; the handlers
   then return `{error: 'missions-not-configured', reason: 'no-mission-scheduler'}`.
3. **Handler module** — `packages/server-core/src/handlers/rpc/missions.ts`
   exports `registerMissionsCoreHandlers(server, deps)`. The module
   includes a small local `assertOwnerOnScope` helper that mirrors
   the `roles.ts` T227 pattern. The upstream `checkOwnerOnScope` is
   not exported and the constraints forbid editing roles.ts, so we
   replicate the same logic verbatim. A second helper
   `assertReadOnScope` consults `RbacResolver.permittedWorkspacesForUser`
   and accepts the global sentinel `'*'`.
4. **Index** — register the new factory inside
   `registerCoreRpcHandlers` alongside the existing T227 roles
   handlers.

## 4. Handlers

| Channel                  | Gating                    | Returns on success           | Error envelopes                                   |
| ------------------------ | ------------------------- | ---------------------------- | ------------------------------------------------- |
| `missions.create`        | owner-on-workspace/global | `{ok, mission}`              | `permission-denied` \| `missions-not-configured`  |
| `missions.dispatchEvent` | owner-on-workspace/global | `{ok, mission}`              | `invalid-argument` \| `mission-not-found` \| `invalid-transition` \| `permission-denied` \| `missions-not-configured` |
| `missions.get`           | read-on-scope             | `{ok, mission}`              | `invalid-argument` \| `mission-not-found` \| `permission-denied` \| `missions-not-configured` |
| `missions.list`          | read-on-scope             | `{ok, missions}`             | `invalid-argument` \| `permission-denied` \| `missions-not-configured` |

`dispatchEvent` validates the input envelope (`isMissionId`,
`event.kind ∈ VALID_EVENT_KINDS`) *before* the permission check so
malformed payloads always get an `invalid-argument` response — auth
state is never leaked through validation timing.

`list` accepts an optional `MissionListFilter`. The `kinds` field is
validated against the `MISSION_STATE_KINDS` tuple before delegating to
the scheduler.

## 5. Test plan

`packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts`
— 37 tests / 58 expect() calls. Breakdown:

- **missions.create** (7 tests) — happy path, persistence, global-owner
  passes any workspace, anonymous rejection, no-owner rejection,
  wrong-workspace-owner rejection, missions-not-configured.
- **missions.dispatchEvent — happy paths** (2 tests) — Pending →
  Running on Start, Running → Completed with output.
- **missions.dispatchEvent — errors** (6 tests) — mission-not-found,
  illegal-transition, invalid-input, invalid-mission-id, missing
  event, unknown event kind.
- **missions.dispatchEvent — owner gating** (3 tests) — editor
  rejection, wrong-workspace owner rejection,
  missions-not-configured.
- **missions.get** (7 tests) — happy reader, not-found, anonymous
  rejection, no-grants rejection, wrong-workspace rejection, invalid
  id, missions-not-configured.
- **missions.list** (9 tests) — list all, kinds filter, empty list,
  wrong-workspace rejection, anonymous rejection, non-array kinds,
  unknown kind, non-object filter, missions-not-configured.
- **Global owner shortcuts** (2 tests) — create with null workspace,
  list across foreign workspace.
- **Registered channels smoke** (1 test) — exactly four channels
  bound.

## 6. Validation

```
$ bun test packages/server-core/src/handlers/rpc/__tests__/missions-rpc.test.ts
 37 pass
 0 fail
 58 expect() calls
Ran 37 tests across 1 file. [155.00ms]
```

`validate:rebrand`, `validate:agent-contract`, `validate:roadmap`
all pass (see commit log).

## 7. LOC

- Source: `missions.ts` 215 LOC (≤350 budget).
- Tests: `missions-rpc.test.ts` 395 LOC (≤500 budget).
- Channel + routing + handler-deps + index wiring: 30 LOC across
  four files.

## 8. Follow-ups

- **T244-rpc** — typed renderer client wrapper that mirrors the four
  channels and surfaces the discriminated `{ok, mission} | {error}`
  union into the React layer.
- **MissionListFilter v2** — workspace-bucketed list filter. Today
  the scheduler is keyed by id alone; downstream tickets add
  per-workspace pagination once the persistent store lands.
