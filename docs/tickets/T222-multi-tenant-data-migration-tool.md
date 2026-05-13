# T222 - Multi-tenant data migration tool

Status: DONE

## Context

Phase 1.6 closes the C4 data-migration gap left in ADR 0007. Existing
single-user installs keep the flat config directory, but operators who opt into
`ROX_MULTI_TENANT=1` need a reversible tool to copy flat data into the
tenant-prefixed storage root.

## Goal

Add a local CLI migration tool that moves the existing flat storage classes into
`<configDir>/tenants/<tenant>/...` with dry-run, apply, idempotent rerun,
checksums, snapshot, lock, and rollback support.

## Required UI

None.

## Required Data/API

- `bun run migrate:multi-tenant -- --tenant <id> --from flat --to tenant-prefixed --dry-run`
- `bun run migrate:multi-tenant -- --tenant <id> --from flat --to tenant-prefixed --apply`
- `bun run migrate:multi-tenant -- --rollback <tenant>`
- Shared helper API for tests and future server/admin wrappers.
- Deterministic migration records for config, credentials, drafts, themes,
  workspaces, conversations, llm-connections, and tool-icons.
- SHA-256 checksums before and after copy.
- Snapshot metadata that rollback can discover without extra arguments.

## Required Automations

None.

## Required Subagents

- Read-only storage explorer to map flat paths, tenant destination convention,
  CLI script patterns, and temp-dir test patterns.

## TDD Requirements

Before implementation:

1. Add `packages/shared/src/config/__tests__/storage-multi-tenant-migration.test.ts`.
2. Prove dry-run reports the deterministic migration plan without creating the
   tenant directory.
3. Prove apply copies files, writes a snapshot, verifies checksums, and preserves
   source flat data.
4. Prove rerunning apply is a no-op when destination files already exist with
   matching checksums.
5. Prove rollback restores from the snapshot.
6. Prove the root CLI entrypoint runs against a temp config directory.

## Implementation Requirements

- Do not add production dependencies.
- Do not alter single-user runtime layout.
- Do not delete flat source data during apply.
- Use a config-dir lock for write operations.
- Use a snapshot before apply writes.
- Keep rollback explicit via `--rollback <tenant>`.
- Keep file-class traversal deterministic.

## Validation Commands

- `bun test packages/shared/src/config/__tests__/storage-multi-tenant-migration.test.ts`
- `bun run migrate:multi-tenant -- --tenant tenant-a --from flat --to tenant-prefixed --dry-run`
- `cd packages/shared && bun run tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## Acceptance Criteria

- [x] Dry-run reports all required storage classes without creating tenant data.
- [x] Apply snapshots the flat config root before copying.
- [x] Apply copies files into `<configDir>/tenants/<tenant>/...`.
- [x] Apply verifies SHA-256 checksums before and after copy.
- [x] Flat source data is preserved during apply.
- [x] Rerun apply is a no-op when destination files already match.
- [x] Rollback restores from the recorded snapshot.
- [x] CLI entrypoint works through `bun run migrate:multi-tenant`.
- [x] Targeted migration tests pass.
- [x] Full relevant validation passes or precise blockers are documented.
- [x] Worklog complete.
- [x] Commit created.

## Worklog

Update `docs/worklog/T222-multi-tenant-data-migration-tool.md`.
