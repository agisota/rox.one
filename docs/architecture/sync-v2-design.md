# Sync V2 Design

Sync V2 turns the T024 local-cloud sync MVP into a durable managed-workspace sync contract. The product rule is still no transparent sync: local files move to cloud only through explicit push, and cloud files move back only through explicit pull. Every write path must preserve no silent overwrite as the default failure mode.

## Goals

- Preserve explicit push and explicit pull as user-visible operations.
- Make the base snapshot the source of truth for detecting local-only, cloud-only, and divergent edits.
- Add a remote operation log so retries, audit history, and conflict explanations can be deterministic.
- Support safe deletions through tombstone records rather than disappearing paths without history.
- Keep object storage, quota checks, and tenant isolation visible in the sync boundary.
- Make Sync V2 implementable with fake adapters for unit and integration tests before any real S3-compatible backend is used.

## Non-Goals

- No transparent sync, background watcher, or Dropbox-style live merge loop.
- No real-time collaboration protocol; team chat and workspace sharing build on separate team/RBAC tickets.
- No direct dependency on AWS S3 APIs in the sync engine. The engine talks to the repository object storage adapter and workspace metadata contracts.
- No automatic conflict resolution that chooses local or cloud content without user review.
- No permanent raw object URLs for protected workspace files.

## Sync Model

Sync V2 has four explicit actors:

- Local file store: the current workspace files on disk or in a local bundle.
- Cloud object store: content-addressed blobs and manifests stored behind the object storage adapter.
- Workspace metadata store: the managed cloud workspace record that binds owner/team, storage prefix, and lifecycle status.
- Sync state store: the local durable record of the last accepted base snapshot and remote operation head.

An explicit push captures the local snapshot, reads the cloud manifest and operation log head, compares both with the base snapshot, rejects conflicts, reserves quota, uploads new blobs to a staged prefix, commits a manifest with a compare-and-swap token, then persists the new base snapshot locally.

An explicit pull captures the local snapshot, reads the cloud manifest and operation log head, compares both with the base snapshot, rejects conflicts, downloads cloud blobs to a temporary location, applies writes/deletes atomically, then persists the new base snapshot locally.

## Snapshot Model

A snapshot is a sorted map of normalized relative paths to file records:

- `path`: POSIX-style relative path, never absolute and never containing traversal.
- `kind`: `file` or `tombstone`.
- `sha256`: content hash for files.
- `sizeBytes`: object size for quota accounting.
- `updatedAt`: logical update time from the producing side.
- `deletedAt`: deletion time for tombstones.
- `actorId`: account or local identity responsible for the last change.

The base snapshot is the last state accepted by both local and cloud. Sync never treats a missing base snapshot as permission to overwrite; first sync is a special import/export operation that still performs a full cloud/local preflight.

## Operation Log

Every committed push creates an operation log entry:

- `operationId`: stable idempotency key for retries.
- `workspaceId`: managed cloud workspace id.
- `baseSnapshotHash`: hash of the base snapshot the client compared against.
- `resultSnapshotHash`: hash of the committed cloud manifest.
- `actorId`: authenticated account user id.
- `writes`: changed paths and blob hashes.
- `deletes`: tombstone paths.
- `createdAt`: server time.
- `commitToken`: storage or metadata compare-and-swap token.

Retries reuse the same operationId. If the operation already committed, the server returns the existing result instead of appending a duplicate. If the cloud head changed under the same operationId before commit, the server rejects the request as a conflict.

## Conflict Detection

Conflict detection is a three-way comparison between base snapshot, local snapshot, and cloud snapshot:

- Local changed and cloud unchanged: safe for push.
- Cloud changed and local unchanged: safe for pull.
- Both changed to the same file hash or same tombstone: safe and idempotent.
- Both changed differently: conflict.
- One side deletes while the other edits: conflict.
- Path appears unsafe or outside tenant prefix: hard validation failure, not a conflict.

The sync engine must collect all conflicts before applying writes. A conflict result includes path, base record, local record, cloud record, and recommended user action. It must never partially apply non-conflicting files after detecting conflicts in the same operation.

## Deletions And Tombstones

Deletes commit tombstone records into the snapshot and operation log. Tombstones include the previous base hash when available, actor id, and deletedAt. Tombstones are retained long enough to detect stale clients and explain deletes in history.

Garbage collection can remove orphaned blobs only after every retained snapshot and tombstone window no longer references them. Garbage collection is a maintenance operation, not part of the user-facing sync command.

## Rename Handling

The MVP can model rename as delete plus write. Sync V2 may add a rename operation when both source and destination hashes prove a move from the same base snapshot:

- `fromPath` existed in the base snapshot.
- `toPath` did not conflict with a cloud or local path.
- `fromHash` matches the deleted source.
- `toHash` matches the written destination.

If any proof is missing, the operation remains delete plus write and may surface as a normal conflict.

## Failure And Retry

Push failure handling:

- Upload blobs to a staged prefix before manifest commit.
- Reserve quota before accepting staged objects.
- Commit manifest with compare-and-swap against the cloud head.
- Persist the new base snapshot only after the commit succeeds.
- Reuse operation idempotency keys on retry.

Pull failure handling:

- Download cloud blobs to a temporary local area.
- Verify hashes before replacing local files.
- Apply files through atomic rename where the platform supports it.
- Persist the new base snapshot only after local application succeeds.
- Leave recoverable temporary files scoped to the workspace and safe to clean.

Network failures, quota failures, and compare-and-swap failures must leave the previous base snapshot intact.

## Security And Tenant Isolation

Every cloud sync request requires an authenticated account session, an active managed workspace, and workspace-level authorization. Local-only sessions cannot access cloud sync APIs.

Tenant isolation rules:

- Object storage keys are scoped under the managed workspace storage prefix.
- The server derives prefixes from workspace metadata, never from client-supplied raw paths.
- Account user, team role, and workspace membership are checked before reading manifests, blobs, or operation history.
- Viewer-style roles may pull only when policy allows; write-capable roles are required for push.
- Browser/research imports must pass through the same permission gate before they can write synced files.
- Logs redact secrets and never include raw signed URLs, cookies, authorization headers, API keys, or object bodies.

## Quotas And Storage

Sync V2 uses the object storage adapter from T022 and performs quota checks before manifest commit. Quota accounting includes new blob bytes minus replaced blob bytes that are no longer referenced by the target workspace snapshot.

Quota failures return a structured error that identifies workspace id, required bytes, available bytes, and operation id. They do not stage partial committed manifests. Default quota tiers remain user and team policy decisions, while the sync engine consumes an explicit quota result from the storage service.

## API Boundaries

Initial API shape:

- `GET /api/account/workspaces/:workspaceId/sync/status`: returns base/head hashes, pending conflict metadata, and last operation summary for the current user.
- `POST /api/account/workspaces/:workspaceId/sync/push`: accepts client base hash, local snapshot metadata, and upload plan; returns conflicts or a staged upload/commit result.
- `POST /api/account/workspaces/:workspaceId/sync/pull`: accepts client base hash and local snapshot metadata; returns conflicts or a download/apply plan.
- `GET /api/account/workspaces/:workspaceId/sync/operations`: returns redacted operation log entries visible to the current user.

The server owns authorization, workspace lookup, tenant prefix derivation, manifest compare-and-swap, quota checks, and operation log writes. The client owns local snapshot capture, local temporary files, and explicit user confirmation of push/pull operations.

## Migration From MVP

T024 already provides the pure conflict engine for explicit local-cloud sync. Sync V2 should extend it in this order:

1. Persist local base snapshots and remote head ids.
2. Add manifest and operation-log stores backed by fake adapters.
3. Wire object storage staging and quota checks.
4. Add account session and workspace authorization around sync APIs.
5. Add UI conflict review before applying push or pull.
6. Add garbage collection and tombstone retention policy.

At each step, existing MVP tests for no silent overwrite must continue to pass.

## Test Plan

- Unit tests: snapshot hashing, path validation, three-way diff, tombstone retention, rename proof, idempotency handling.
- Integration tests with fake providers: object storage staging, quota reservation, compare-and-swap rejection, operation log replay.
- Security tests: 401 for unauthenticated users, 403 for cross-tenant workspace access, deny-by-default for write-disabled roles, no raw object URLs in responses.
- Sync tests: explicit push, explicit pull, cloud deletion, local deletion, divergent edit conflict, delete-versus-edit conflict, retry after network failure, stale base snapshot rejection.
- Quota tests: upload above quota fails before manifest commit, overwrite accounting subtracts replaced bytes, cross-workspace quota reads are denied.
- UI tests: conflict list renders all conflicting paths, empty sync state is clear, error states do not imply data was applied.
