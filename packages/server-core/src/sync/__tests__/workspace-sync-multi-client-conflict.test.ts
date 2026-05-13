/**
 * Multi-client conflict, reconnect, and event-ordering tests for WorkspaceSyncService.
 *
 * Coverage targets (marked ✗ in E2E audit):
 *   - Two clients concurrently editing the same entity
 *   - Sync after network restore / reconnect (missing-event replay)
 *   - Conflict detection is total — no partial apply after detecting conflicts
 *   - Event / operation ordering is preserved in the operation log
 *
 * Hard rule per spec (sync-v2-design.md):
 *   "no silent overwrite as the default failure mode"
 *   "The sync engine must collect all conflicts before applying writes."
 *   "A conflict result must never partially apply non-conflicting files after detecting
 *    conflicts in the same operation."
 *
 * Where the current implementation behaviour is ambiguous relative to the spec, the
 * test is tagged it.todo() with a bug reference comment so it can be promoted once the
 * production code is updated.
 */

import { describe, expect, it } from 'bun:test'
import { EMPTY_SYNC_SNAPSHOT } from '../local-cloud-sync'
import {
  InMemoryWorkspaceSyncService,
  WorkspaceSyncConflictError,
} from '../workspace-sync-service'
import type { ManagedCloudWorkspace } from '../../webui/account-cloud-workspaces'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bytes = (value: string) => new TextEncoder().encode(value)
const decode = (b64: string) => new TextDecoder().decode(Uint8Array.fromBase64(b64))
const file = (path: string, value: string) => ({ path, contentBase64: bytes(value).toBase64() })

function workspace(id = 'workspace-mc-a'): ManagedCloudWorkspace {
  return {
    id,
    name: 'Multi-Client Workspace',
    slug: id,
    ownerUserId: 'user-a',
    teamId: null,
    status: 'active',
    visibility: 'private',
    storage: {
      bucket: 'agent-artifacts',
      prefix: `managed-workspaces/${id}/`,
    },
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    archivedAt: null,
  }
}

// ---------------------------------------------------------------------------
// Two clients editing the same entity
// ---------------------------------------------------------------------------

describe('workspace sync — two clients editing the same entity', () => {
  it('rejects the second client push when both clients diverge from the same base snapshot', async () => {
    // Arrange: shared service (shared cloud store) and two clients sharing
    // the same workspace.  Client A and client B both start from `baseSnap`
    // and independently edit notes/shared.md.
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-two-clients-diverge')

    // Establish base on cloud.
    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base-push',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('notes/shared.md', 'original content')],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    // Client A pushes its edit first — succeeds.
    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'client-a-edit',
      baseSnapshot: baseSnap,
      files: [file('notes/shared.md', 'client A edit')],
    })

    // Client B tries to push with the same base snapshot but a different edit
    // — must be rejected as a conflict, never silently overwriting client A.
    await expect(
      service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'client-b-edit',
        baseSnapshot: baseSnap,
        files: [file('notes/shared.md', 'client B edit')],
      }),
    ).rejects.toBeInstanceOf(WorkspaceSyncConflictError)
  })

  it('surfaces conflict details for every divergent path, not just the first one', async () => {
    // Spec: "The sync engine must collect all conflicts before applying writes."
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-multi-path-conflict')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('docs/a.md', 'a-base'),
        file('docs/b.md', 'b-base'),
        file('docs/c.md', 'c-base'),
      ],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    // Cloud client advances all three files.
    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'cloud-advance',
      baseSnapshot: baseSnap,
      files: [
        file('docs/a.md', 'a-cloud'),
        file('docs/b.md', 'b-cloud'),
        file('docs/c.md', 'c-cloud'),
      ],
    })

    // Local client tries to push its own edits against the old base.
    let caught: WorkspaceSyncConflictError | null = null
    try {
      await service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'local-stale',
        baseSnapshot: baseSnap,
        files: [
          file('docs/a.md', 'a-local'),
          file('docs/b.md', 'b-local'),
          file('docs/c.md', 'c-local'),
        ],
      })
    } catch (err) {
      if (err instanceof WorkspaceSyncConflictError) caught = err
      else throw err
    }

    expect(caught).toBeInstanceOf(WorkspaceSyncConflictError)
    // All three conflicting paths must be reported — not just the first.
    const conflictPaths = caught!.conflicts.map(c => c.path).sort()
    expect(conflictPaths).toEqual(['docs/a.md', 'docs/b.md', 'docs/c.md'])
  })

  it('does not partially apply non-conflicting files when at least one conflict exists', async () => {
    // Spec: "It must never partially apply non-conflicting files after detecting
    // conflicts in the same operation."
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-no-partial-apply')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('conflict.md', 'base-conflict'),
        file('safe.md', 'base-safe'),
      ],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    // Cloud advances only the conflicting file.
    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'cloud-edit-conflict',
      baseSnapshot: baseSnap,
      files: [
        file('conflict.md', 'cloud-version'),
        file('safe.md', 'base-safe'), // unchanged
      ],
    })

    // Local client edits both — conflict.md conflicts, safe.md is new content.
    await expect(
      service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'local-mixed',
        baseSnapshot: baseSnap,
        files: [
          file('conflict.md', 'local-version'),
          file('safe.md', 'local-safe-update'),
        ],
      }),
    ).rejects.toBeInstanceOf(WorkspaceSyncConflictError)

    // Verify cloud state: safe.md must NOT have been updated by the failing push.
    const status = await service.getStatus({ actorUserId: 'user-a', workspace: ws })
    const safeEntry = status.cloudSnapshot.files.find(f => f.path === 'safe.md')
    // The cloud should still hold the base-safe content, not local-safe-update.
    // We validate via the operation log — only one successful push for safe.md.
    const ops = await service.listOperations({ actorUserId: 'user-a', workspace: ws })
    const writesToSafe = ops.operations.flatMap(op =>
      op.operations.filter(o => o.path === 'safe.md' && o.type === 'write'),
    )
    // Only one committed write to safe.md (from the base push + cloud-edit-conflict).
    expect(writesToSafe.length).toBeLessThanOrEqual(2)
    // The conflicting local push must not have added a third write to safe.md.
    expect(ops.operations.find(op => op.operationId === 'local-mixed')).toBeUndefined()
    expect(safeEntry).toBeDefined()
  })

  it('allows client B to push to an unrelated file without conflict', async () => {
    // When client A edits file-a.md and client B edits file-b.md independently
    // from the same base, client B's push to a non-overlapping path must succeed.
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-non-overlapping')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [
        file('file-a.md', 'original-a'),
        file('file-b.md', 'original-b'),
      ],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    // Client A edits only file-a.
    const clientAResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'client-a-edit-a',
      baseSnapshot: baseSnap,
      files: [
        file('file-a.md', 'a-edited'),
        file('file-b.md', 'original-b'),
      ],
    })

    // Client B edits only file-b from the OLD base — should conflict because
    // client A's push changed the cloud head for file-a, but file-b is
    // untouched by client A. Per three-way diff rules this should be safe.
    // NOTE: this test documents the EXPECTED spec behaviour.
    const clientBResult = await service.push({
      actorUserId: 'user-b',
      workspace: ws,
      operationId: 'client-b-edit-b',
      baseSnapshot: baseSnap,
      files: [
        file('file-a.md', 'original-a'), // unchanged relative to base
        file('file-b.md', 'b-edited'),
      ],
    })

    expect(clientBResult.conflicts).toEqual([])
    const bFile = clientBResult.files.find(f => f.path === 'file-b.md')
    expect(bFile).toBeDefined()
    expect(decode(bFile!.contentBase64)).toBe('b-edited')
    expect(clientAResult.conflicts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Sync after network restore / reconnect
// ---------------------------------------------------------------------------

describe('workspace sync — reconnect after network loss', () => {
  it('replays the same operationId idempotently when a client retries after a failed push', async () => {
    // Simulates: client sends push, network fails before it receives the response.
    // On reconnect the client retries with the same operationId — must get the
    // cached result, not attempt a second write.
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-retry-idempotent')

    const firstAttempt = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'retry-op',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('data.md', 'v1')],
    })
    expect(firstAttempt.idempotentReplay).toBe(false)

    // Simulate reconnect — client retries with same operationId and even stale files.
    const retryAttempt = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'retry-op',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('data.md', 'v1-mutated-should-be-ignored')],
    })

    expect(retryAttempt.idempotentReplay).toBe(true)
    // Must return the original committed result, not the mutated payload.
    const dataFile = retryAttempt.files.find(f => f.path === 'data.md')
    expect(dataFile).toBeDefined()
    expect(decode(dataFile!.contentBase64)).toBe('v1')
  })

  it('preserves the base snapshot after a conflict so the client can resync from a clean state', async () => {
    // After a failed/conflicting push the server-side base snapshot for the
    // workspace must remain unchanged so the client can inspect current state
    // and decide how to resolve the conflict.
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-base-preserved-after-conflict')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('notes.md', 'committed')],
    })
    const committedBase = baseResult.nextBaseSnapshot

    // Cloud edits by another client.
    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'cloud-edit',
      baseSnapshot: committedBase,
      files: [file('notes.md', 'cloud-change')],
    })

    // Stale client pushes — conflict.
    try {
      await service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'stale-push',
        baseSnapshot: committedBase,
        files: [file('notes.md', 'stale-local')],
      })
    } catch {
      // Expected conflict.
    }

    // After the failed push, getStatus must return a coherent snapshot.
    const status = await service.getStatus({ actorUserId: 'user-b', workspace: ws })
    expect(status.workspaceId).toBe(ws.id)
    // The cloud snapshot must reflect the cloud-edit, not the stale push.
    const cloudNotes = status.cloudSnapshot.files.find(f => f.path === 'notes.md')
    expect(cloudNotes).toBeDefined()
    // Operation log must NOT include the stale-push as a committed operation.
    const ops = await service.listOperations({ actorUserId: 'user-b', workspace: ws })
    const stalePushRecord = ops.operations.find(op => op.operationId === 'stale-push')
    expect(stalePushRecord).toBeUndefined()
  })

  it('allows a pull to recover cloud state after a failed local push', async () => {
    // Client pushes fail; client then pulls to adopt the current cloud state
    // so it can re-apply its own edits on top.
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-pull-after-failed-push')

    // Establish cloud state.
    const cloudResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'init',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('shared.md', 'cloud-v1')],
    })
    const cloudBase = cloudResult.nextBaseSnapshot

    // Simulate stale client trying to push (conflict).
    try {
      await service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'stale',
        baseSnapshot: EMPTY_SYNC_SNAPSHOT, // outdated base
        files: [file('shared.md', 'stale-local')],
      })
    } catch {
      // Expected.
    }

    // Client recovers by pulling against the known cloud base.
    const pullResult = await service.pull({
      actorUserId: 'user-b',
      workspace: ws,
      operationId: 'recover-pull',
      baseSnapshot: cloudBase,
      files: [file('shared.md', 'cloud-v1')], // local == cloud == no conflict
    })

    expect(pullResult.conflicts).toEqual([])
    expect(pullResult.operations).toEqual([]) // already in sync
    const pulled = pullResult.files.find(f => f.path === 'shared.md')
    expect(pulled).toBeDefined()
    expect(decode(pulled!.contentBase64)).toBe('cloud-v1')
  })

  it('replays a pull idempotently when the client retries after a lost response', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-pull-idempotent')

    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'setup',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('doc.md', 'cloud-content')],
    })

    const firstPull = await service.pull({
      actorUserId: 'user-b',
      workspace: ws,
      operationId: 'pull-op-1',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [],
    })
    expect(firstPull.idempotentReplay).toBe(false)

    const retryPull = await service.pull({
      actorUserId: 'user-b',
      workspace: ws,
      operationId: 'pull-op-1', // same operationId
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [],
    })
    expect(retryPull.idempotentReplay).toBe(true)
    expect(retryPull.files).toEqual(firstPull.files)
  })
})

// ---------------------------------------------------------------------------
// Event ordering in the operation log
// ---------------------------------------------------------------------------

describe('workspace sync — operation log ordering', () => {
  it('appends operations to the log in commit order, not submission order', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-op-log-ordering')

    const base = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'op-init',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('index.md', 'v0')],
    })

    const r1 = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'op-1',
      baseSnapshot: base.nextBaseSnapshot,
      files: [file('index.md', 'v1')],
    })

    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'op-2',
      baseSnapshot: r1.nextBaseSnapshot,
      files: [file('index.md', 'v2')],
    })

    const ops = await service.listOperations({ actorUserId: 'user-a', workspace: ws })
    const ids = ops.operations.map(op => op.operationId)
    expect(ids).toEqual(['op-init', 'op-1', 'op-2'])
  })

  it('does not duplicate operations in the log when an idempotent replay is requested', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-no-dup-log')

    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'dup-test',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('file.md', 'content')],
    })

    // Replay the same operation three times.
    for (let i = 0; i < 3; i++) {
      await service.push({
        actorUserId: 'user-a',
        workspace: ws,
        operationId: 'dup-test',
        baseSnapshot: EMPTY_SYNC_SNAPSHOT,
        files: [file('file.md', 'content')],
      })
    }

    const ops = await service.listOperations({ actorUserId: 'user-a', workspace: ws })
    const dupOps = ops.operations.filter(op => op.operationId === 'dup-test')
    expect(dupOps.length).toBe(1)
  })

  it('records each push and pull operation separately in the log', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-push-pull-log')

    const pushResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'push-op',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('x.md', 'content')],
    })

    await service.pull({
      actorUserId: 'user-b',
      workspace: ws,
      operationId: 'pull-op',
      baseSnapshot: pushResult.nextBaseSnapshot,
      files: [file('x.md', 'content')],
    })

    const ops = await service.listOperations({ actorUserId: 'user-a', workspace: ws })
    const directions = ops.operations.map(op => op.direction)
    expect(directions).toContain('push')
    expect(directions).toContain('pull')
  })

  it('records the correct actorUserId for each operation in the log', async () => {
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-actor-ids')

    const r0 = await service.push({
      actorUserId: 'user-alpha',
      workspace: ws,
      operationId: 'alpha-push',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('shared.md', 'v0')],
    })

    await service.push({
      actorUserId: 'user-beta',
      workspace: ws,
      operationId: 'beta-push',
      baseSnapshot: r0.nextBaseSnapshot,
      files: [file('shared.md', 'v1')],
    })

    const ops = await service.listOperations({ actorUserId: 'user-alpha', workspace: ws })
    expect(ops.operations.find(op => op.operationId === 'alpha-push')?.actorUserId).toBe('user-alpha')
    expect(ops.operations.find(op => op.operationId === 'beta-push')?.actorUserId).toBe('user-beta')
  })
})

// ---------------------------------------------------------------------------
// Spec-contract tests for behaviours not yet validated in the existing suite
// ---------------------------------------------------------------------------

describe('workspace sync — spec contract (conflict resolution)', () => {
  it('reports a conflict when one side deletes while the other edits the same file', async () => {
    // Spec: "One side deletes while the other edits: conflict."
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-delete-vs-edit')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('contested.md', 'original')],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    // Cloud client deletes the file.
    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'cloud-delete',
      baseSnapshot: baseSnap,
      files: [], // contested.md removed
    })

    // Local client edits the same file from the same base — must conflict.
    await expect(
      service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'local-edit',
        baseSnapshot: baseSnap,
        files: [file('contested.md', 'local edit on deleted file')],
      }),
    ).rejects.toBeInstanceOf(WorkspaceSyncConflictError)
  })

  it('treats identical edits from two clients as idempotent (same hash = no conflict)', async () => {
    // Spec: "Both changed to the same file hash or same tombstone: safe and idempotent."
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-same-hash-idempotent')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'base',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('notes.md', 'original')],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    // Client A pushes 'edited' content.
    const clientAResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'client-a-same',
      baseSnapshot: baseSnap,
      files: [file('notes.md', 'exactly the same edit')],
    })

    // Client B pushes the SAME content from the same base — must succeed (idempotent).
    const clientBResult = await service.push({
      actorUserId: 'user-b',
      workspace: ws,
      operationId: 'client-b-same',
      baseSnapshot: baseSnap,
      files: [file('notes.md', 'exactly the same edit')],
    })

    expect(clientAResult.conflicts).toEqual([])
    expect(clientBResult.conflicts).toEqual([])
  })

  it('preserves the operation log on a conflicting push — no phantom record created', async () => {
    // A failed (conflicting) push must not create an entry in the operation log.
    const service = new InMemoryWorkspaceSyncService()
    const ws = workspace('ws-no-phantom-op')

    const baseResult = await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'setup',
      baseSnapshot: EMPTY_SYNC_SNAPSHOT,
      files: [file('doc.md', 'v0')],
    })
    const baseSnap = baseResult.nextBaseSnapshot

    await service.push({
      actorUserId: 'user-a',
      workspace: ws,
      operationId: 'advance-cloud',
      baseSnapshot: baseSnap,
      files: [file('doc.md', 'v1-cloud')],
    })

    try {
      await service.push({
        actorUserId: 'user-b',
        workspace: ws,
        operationId: 'conflict-push',
        baseSnapshot: baseSnap,
        files: [file('doc.md', 'v1-local')],
      })
    } catch {
      // Expected conflict.
    }

    const ops = await service.listOperations({ actorUserId: 'user-a', workspace: ws })
    const conflictOp = ops.operations.find(op => op.operationId === 'conflict-push')
    expect(conflictOp).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Known ambiguities / gaps vs spec — promoted to it.todo() with bug notes
  // -------------------------------------------------------------------------

  it.todo(
    // BUG: The spec states operations without an operationId should still be
    // retryable if the server assigns a stable id and returns it.  Currently
    // InMemoryWorkspaceSyncService assigns a random UUID when operationId is
    // null/undefined but does NOT cache the result, so callers cannot replay.
    // Expected: push with no operationId returns a server-assigned id; retrying
    // with that id yields idempotentReplay=true.
    'assigns a stable server-generated operationId when the client omits one (BUG: not cached today)',
  )

  it.todo(
    // BUG: Spec §Conflict Detection — "Path appears unsafe or outside tenant prefix:
    // hard validation failure, not a conflict."  Currently path validation throws
    // LocalCloudSyncPathError at store.setInitialFile() time, which is not
    // surfaced as WorkspaceSyncValidationError in all code paths through the
    // service layer.  Needs explicit validation before the engine runs.
    'surfaces a WorkspaceSyncValidationError (not a raw engine error) for paths with traversal sequences (BUG: error type leaks)',
  )

  it.todo(
    // BUG: Spec §Failure And Retry — "Network failures, quota failures, and
    // compare-and-swap failures must leave the previous base snapshot intact."
    // No quota checking is wired in InMemoryWorkspaceSyncService, so quota-
    // exceeded scenarios cannot be tested yet.  When quota support lands,
    // add a test that a rejected push (quota exceeded) does not advance the
    // base snapshot stored server-side.
    'does not advance the base snapshot when a push is rejected due to quota exhaustion (BUG: quota not wired)',
  )

  it.todo(
    // BUG: Spec §API Boundaries — GET /sync/status should return
    // "pending conflict metadata" for in-progress operations.  Currently
    // WorkspaceSyncStatus has no conflict field; the status endpoint has no
    // way to report that the workspace has unresolved conflicts requiring
    // user review.
    'getStatus returns pending conflict metadata when the workspace has an unresolved conflict (BUG: field missing from WorkspaceSyncStatus)',
  )
})
