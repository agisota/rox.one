# Decision 0108: Missions Subsystem RPC Contract

- Status: accepted
- Date: 2026-05-14

## Canonical
```text
missions admin RPC surface exposes four channels:
  missions.create
  missions.dispatchEvent
  missions.get
  missions.list

all channels are REMOTE_ELIGIBLE:
  scheduler runs on whichever server owns the workspace

owner-gate applies to mutating channels (create, dispatchEvent):
  global owner grant
  OR workspace-scoped owner grant with matching scopeId

read channels (get, list) require:
  permittedWorkspacesForUser includes '*' or the request's workspaceId

missionScheduler is optional in HandlerDeps:
  hosts that have not adopted M.8 receive:
    { error: 'missions-not-configured' }
  not a thrown exception

handler failures return structured objects:
  { error, reason }
  not thrown exceptions

owner-gate helper is local to missions.ts:
  assertOwnerOnScope pattern mirrors roles.ts T227
  roles.ts itself is not modified
```

## Why
- Making `missionScheduler` optional in `HandlerDeps` keeps existing hosts fully operational without adopting the M.8 surface, satisfying the zero-breakage constraint on the shared handler registry.
- Structured `{error, reason}` returns (rather than thrown exceptions) align with the established RPC error contract already used by labels, roles, and skills handlers.
- REMOTE_ELIGIBLE classification allows the scheduler — which is keyed to workspace ownership — to run on any server node holding the workspace, preserving multi-tenant routing consistency.
- Duplicating the owner-gate helper locally avoids a premature export from `roles.ts` while concurrent RBAC work was in flight.
