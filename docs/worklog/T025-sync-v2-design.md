# T025 Sync V2 Design

## Task summary

Design the Sync V2 architecture after the explicit local-cloud sync MVP so future implementation work has a checked contract for snapshots, conflict handling, tombstones, retries, tenant isolation, object storage, quotas, and API boundaries.

## Repo context discovered

- `docs/tickets/T025-sync-v2-design.md` is a placeholder ticket with the standard TDD loop.
- `docs/worklog/T024-local-cloud-sync-mvp.md` records the MVP sync engine as explicit push/pull with base snapshots, SHA-256 entries, path guards, and no silent overwrites.
- `packages/server-core/src/sync/local-cloud-sync.ts` contains the MVP pure engine and should remain the implementation baseline rather than becoming an implicit background sync feature.
- `packages/server-core/src/storage/object-storage.ts` contains the quota-checked object storage seam from T022.
- `packages/server-core/src/webui/account-cloud-workspaces.ts` contains the managed cloud workspace metadata model from T023.
- `docs/architecture/repo-map.md` already states that cloud sync must not assume transparent sync and that managed cloud requires auth boundaries, tenant isolation, quotas, lifecycle, and audit logs.
- Existing docs validation is script-driven through `package.json` and `scripts/validate-architecture-docs.ts`.

## Files inspected

- `docs/tickets/T025-sync-v2-design.md`
- `docs/worklog/T024-local-cloud-sync-mvp.md`
- `docs/architecture/repo-map.md`
- `scripts/validate-architecture-docs.ts`
- `scripts/validate-agent-contract.ts`
- `package.json`

## Tests added first

- Added `scripts/validate-sync-v2-design.ts`.
- Added `validate:sync-v2-design` and wired it into `validate:docs`.

## Expected failing test output

`bun run validate:sync-v2-design` failed for the expected reason before the design document existed:

```text
[sync-v2-design] missing required file: /Users/marklindgreen/Projects/craft/craft/docs/architecture/sync-v2-design.md
error: script "validate:sync-v2-design" exited with code 1
```

## Implementation changes

- Added `docs/architecture/sync-v2-design.md` with the V2 contract for explicit push/pull, base snapshots, operation logs, conflicts, tombstones, rename handling, retries, auth/tenant isolation, quotas, storage, APIs, migration path, and test plan.
- Added `scripts/validate-sync-v2-design.ts` to make the design document testable.
- Wired `validate:sync-v2-design` into `validate:docs` so the contract stays checked in normal docs validation.

## Validation commands run

- `bun run validate:sync-v2-design`
- `bun run validate:docs`
- `cd packages/server-core && bun run tsc --noEmit`
- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `git diff --check`
- `bun run electron:build`

## Passing test output summary

- `bun run validate:sync-v2-design`: `[sync-v2-design] validated /Users/marklindgreen/Projects/craft/craft/docs/architecture/sync-v2-design.md`
- `bun run validate:docs`: agent contract, architecture docs, and sync V2 design checks passed.
- `cd packages/server-core && bun run tsc --noEmit`: passed.
- `bun run typecheck:shared`: passed.
- `bun run typecheck:electron`: passed.
- `git diff --check`: passed with no whitespace errors.

## Build output summary

`bun run electron:build` passed. Main, preload, renderer, resources, and electron assets built successfully. Renderer emitted the repo's existing large chunk warnings.

## Remaining risks

- This ticket is design and validation only; no Sync V2 API, storage wiring, UI conflict review, or durable operation log was implemented.
- Real object storage, sync leases/compare-and-swap, and signed URL handling remain future implementation work.
- Multi-writer locking and tombstone garbage collection policy are designed but not implemented.

## Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Sync V2 design has a checked architecture document | Pass | `docs/architecture/sync-v2-design.md`; `bun run validate:sync-v2-design` |
| Design preserves explicit push/pull rather than transparent sync | Pass | Design states no transparent sync and defines explicit push/explicit pull flows |
| Design covers base snapshots, op log, tombstones, conflicts, retries, idempotency, tenant isolation, quotas, and object storage | Pass | Required sections and phrases enforced by `scripts/validate-sync-v2-design.ts` |
| Docs validation catches missing/weak design content | Pass | Red run failed when the design file was missing; `validate:docs` now includes the Sync V2 gate |
