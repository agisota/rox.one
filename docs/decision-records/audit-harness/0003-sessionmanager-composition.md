# Decision 0003: SessionManager Composition Refactor

- Status: accepted (commits 1–3 of 3 landed)
- Date: 2026-05-09

## Canonical

The 7754-LOC `SessionManager` class is decomposed into a thin facade that owns three helper classes via composition. The public `ISessionManager` interface is byte-stable; external callers see no change.

```text
packages/server-core/src/sessions/
  SessionManager.ts                6147 LOC  (facade: lifecycle, CRUD, sendMessage, processEvent, runtime — coordinators that touch ≥2 helpers)
  session-manager-helpers.ts        902 LOC  (pre-class helpers extracted in Slice 3 / decomp 2 bounded; module-level toolkit)
  session-ipc.ts                    197 LOC  (eventSink, browserPaneManager, delta queues, broadcasts; LEAF — no helper deps)
  session-persistence.ts            322 LOC  (disk I/O, JSONL writes, message hydration, persist queue, getSessionPath; depends on IPC)
  session-auth.ts                   592 LOC  (credential/permission resolvers, admin-remember, attempt-retry; depends on IPC + Persistence + SM callbacks)
```

```text
Construction (in SessionManager constructor):
  this.ipc          = new SessionIPC({ ... })
  this.persistence  = new SessionPersistence(() => this.sessions, this.ipc, ...)
  this.auth         = new SessionAuth({ getSessions, ipc, persistence, sendMessage, setProcessing, onProcessingStopped })

Dependency graph (no cycles):
  IPC  →  ∅
  Persistence  →  IPC
  Auth  →  IPC, Persistence, SM-callbacks
  SessionManager  →  all three
```

## Why

- **Cohesion shape forced composition, not movement.** SessionManager is one cohesive class with ~100 methods sharing `this.sessions`, `this.eventSink`, `this.pendingDeltas` etc. A storage-style file split (Slice 3 / decomp 1) would have been a hack. Helper classes that hold their own state and expose narrow interfaces are the honest decomposition.
- **`sessions: Map<string, ManagedSession>` stays canonically on SessionManager.** It's the system's source of truth; helpers receive a `() => Map` getter, not a snapshot. This documents the dependency direction without locking in the storage choice — a future swap to a different store doesn't ripple into helpers.
- **Cross-helper communication is direct and one-way only.** Persistence calls `this.ipc.broadcastUnreadSummary()` directly because broadcasting on disk-write is a legitimate concern. Auth calls `this.persistence.persistSession(managed)` directly because completing an auth request implies a persist. The forbidden directions (Persistence → Auth, IPC → either) prevent the cyclic temptation.
- **Coordinator methods stay on SessionManager.** `sendMessage`, `processEvent`, `cancelProcessing`, `onProcessingStopped`, `processNextQueuedMessage`, `getOrCreateAgent`, all session-lifecycle CRUD (`flagSession`, `archiveSession`, `renameSession`, `deleteSession`, `shareToViewer`, `importSession`, etc.), and `initialize`/`cleanup` orchestrate across multiple helpers. Moving them creates worse coupling than leaving them. This is why SessionManager.ts is still 6147 LOC — see "Out of scope" below.
- **Public API delegation is one-line.** Methods on `ISessionManager` (`flushSession`, `flushAllSessions`, `getSessionPath`, `completeAuthRequest`, `handleCredentialInput`, `respondToCredential`, `respondToPermission`, `reinitializeAuth`) keep their signatures but delegate: `return this.auth.completeAuthRequest(sid, result)`. External callers see no change.
- **Test-shims documented when needed.** `cold-session-metadata.test.ts` reaches into private `persistSession` via `(sm as unknown as { persistSession: ... })`. To preserve the test without rewriting it, SessionManager keeps a private `persistSession` test-shim (annotated comment) that delegates to `this.persistence.persistSession(managed)`. Honest about the indirection rather than hiding it.

## Out of scope

- **The plan's "no file > 2000 LOC" exit gate is not met by SessionManager.** Final size is 6147 LOC, not <2000. Reason: the planner correctly identified that ~4500 LOC of coordinator methods (`sendMessage` ~600, `processEvent` ~600, session CRUD ~800, agent runtime ~500, `initialize`/`cleanup` ~300, plus ancillary methods) cannot move into helpers without introducing cyclic dependencies or moving the `sessions` Map itself. The composition refactor delivered the cohesion improvement; the literal LOC bar requires further work — possibly extracting `MessageProcessor`, `SessionLifecycle`, or `AgentRuntimeManager` as additional helpers — which is its own design pass.
- **Tenancy contracts (`WorkspaceScope` parameter on every persistence call).** Slice 3's tenancy sweep is a separate workstream. The new helpers' constructors are forward-compatible: a future commit can thread `WorkspaceScope` through `SessionPersistence`'s methods and through the persistence-helper deps without re-architecting.
- **Removing the `persistSession` test-shim.** Rewriting `cold-session-metadata.test.ts` to use the public API (or to inject a fake `SessionPersistence`) is a follow-up; out of scope here so the refactor stays "no behavior change, no test changes."
- **The `SessionAuth` `sendMessage` callback closure.** Auth-retry needs `sendMessage`, `setProcessing`, `onProcessingStopped` injected as callbacks because moving them into a fourth helper (`SessionLifecycle`) is the next composition pass. Keeping the callbacks here is honest about the unfinished decomposition.

## Result

| Metric | Pre-Slice 3 | After commit 1 (IPC) | After commit 2 (Persistence) | After commit 3 (Auth) |
|---|---|---|---|---|
| SessionManager.ts LOC | 7754 | 6816 | 6579 | 6147 |
| Helper LOC total | 0 | 197 | 519 | 1111 |
| shared tests | 2880 / 12 skip / 5 fail | unchanged | unchanged | unchanged |
| server-core tests | 238 / 0 fail | unchanged | unchanged | unchanged |
| `tsc --noEmit` | EXIT=0 | EXIT=0 | EXIT=0 | EXIT=0 |

Three atomic commits: `da3391f`, `7635db5`, `8b99dc8`. Each preserves both test baselines exactly. The composition design is documented; the LOC bar is acknowledged as deferred.
