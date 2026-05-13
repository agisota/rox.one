# T222 - Multi-tenant data migration tool

## 1. Task summary

Add reversible local migration tooling for copying flat single-user storage data
into a tenant-prefixed storage root.

## 2. Repo context discovered

- `getConfigDirForScope()` resolves active workspace scopes to
  `<configDir>/tenants/<workspaceId>` only when `ROX_MULTI_TENANT=1`.
- Flat single-user storage must remain in place and unchanged by normal runtime
  behavior.
- Credentials, drafts, themes, workspaces, conversations, llm-connections, and
  tool-icons are all represented by files under the config root; llm connection
  data is embedded in `config.json`.
- Root executable scripts are wired through `package.json` as
  `bun run scripts/<name>.ts`.

## 3. Files inspected

- `AGENTS.md`
- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `packages/shared/src/config/paths.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/storage-scope.ts`
- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/storage-drafts.ts`
- `packages/shared/src/config/storage-themes.ts`
- `packages/shared/src/config/storage-tool-icons.ts`
- `packages/shared/src/config/storage-conversations.ts`
- `packages/shared/src/config/storage-llm-connections.ts`
- `packages/shared/src/credentials/backends/secure-storage.ts`
- `packages/shared/src/config/__tests__/storage-migrations.test.ts`
- `packages/shared/src/config/__tests__/storage-startup-migration.test.ts`
- `packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts`
- `package.json`

## 4. Tests added first

Added `packages/shared/src/config/__tests__/storage-multi-tenant-migration.test.ts`
before implementing the migration module.

The test file proves:

- Dry-run returns a deterministic plan for config, credentials, drafts, themes,
  workspaces, conversations, llm-connections, and tool-icons without creating a
  tenant directory.
- Apply writes a snapshot, copies files into
  `<configDir>/tenants/<tenant>/...`, verifies SHA-256 checksums, and preserves
  flat source data.
- Re-running apply returns a no-op when existing tenant files match the source
  checksums.
- Rollback restores the local config directory from the recorded snapshot.
- The root `bun run migrate:multi-tenant` entrypoint runs against a temp config
  directory.

## 5. Expected failing test output

Red run:

- Command:
  `bun test packages/shared/src/config/__tests__/storage-multi-tenant-migration.test.ts`
- Result: exit 1.
- Expected failure: `Cannot find module '../storage-multi-tenant-migration'`
  from the new test file.

The failure showed the tests were exercising a missing migration API, not an
unrelated runtime failure.

## 6. Implementation changes

- Added `packages/shared/src/config/storage-multi-tenant-migration.ts` with
  dry-run, apply, idempotent rerun, lock, snapshot, checksum, and rollback
  helpers.
- Added deterministic local flat-file discovery for config, credentials,
  drafts, themes, workspaces, conversations, llm-connections, and tool-icons.
- Kept single-user runtime data in the flat config root; apply copies into
  `tenants/<tenant>/...` and never deletes flat source files.
- Wrote migration snapshots under a sibling
  `<configDir>.migration-snapshots/<tenant>/...` root and stored
  `latest.json` for rollback discovery.
- Added a sibling `<configDir>.multi-tenant-migration.lock` write lock around
  apply and rollback operations.
- Added `scripts/migrate-multi-tenant.ts` plus the root
  `migrate:multi-tenant` package script.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/storage-multi-tenant-migration.test.ts`
- `tmp=$(mktemp -d); printf '{"workspaces":[],"activeWorkspaceId":null,"activeSessionId":null,"llmConnections":[]}' > "$tmp/config.json"; printf 'secret' > "$tmp/credentials.enc"; ROX_CONFIG_DIR="$tmp" bun run migrate:multi-tenant -- --tenant tenant-a --from flat --to tenant-prefixed --dry-run; status=$?; rm -rf "$tmp" "$tmp.migration-snapshots" "$tmp.multi-tenant-migration.lock"; exit $status`
- `cd packages/shared && bun run tsc --noEmit`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun test`
- `bun run build`

## 8. Passing test output summary

- Targeted migration test: 4 pass, 0 fail, 27 `expect()` calls.
- CLI dry-run smoke: exit 0 and returned `status: "planned"` for config and
  credentials files.
- Shared package TypeScript check: exit 0.
- Workspace typecheck: exit 0.
- Lint: exit 0.
- Agent contract validation: exit 0.
- Docs validation: exit 0.
- Whitespace check: exit 0.
- Full test suite: 5082 pass, 13 skip, 0 fail, 1 snapshot, 12774 `expect()`
  calls, 5095 tests across 457 files in 67.62s.

## 9. Build output summary

`bun run build` completed with exit 0. The build still prints existing Vite
large chunk warnings; T222 did not add production dependencies or frontend
runtime paths.

## 10. Remaining risks

- Production operator rollout guidance remains a later release/process task.
- The tool migrates local files only; managed cloud object-store migration is
  out of scope for Phase 1.6.
- Rollback is an explicit operator action because it replaces the local config
  directory with the recorded snapshot.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Dry-run reports all required storage classes without creating tenant data | Green | Targeted dry-run test asserts required classes and absent tenant directory |
| Apply snapshots the flat config root before copying | Green | Targeted apply test asserts `snapshotDir` and copied `flat/config.json` |
| Apply copies files into tenant-prefixed storage | Green | Targeted apply test reads tenant credential and workspace conversation files |
| Apply verifies SHA-256 checksums before and after copy | Green | Targeted apply test asserts copied files are verified and source/destination hashes match |
| Flat source data is preserved during apply | Green | Targeted apply test reads original `credentials.enc` after apply |
| Rerun apply is a no-op when destination files already match | Green | Targeted rerun assertions return `status: "noop"` and all files `skip-existing` |
| Rollback restores from the recorded snapshot | Green | Targeted rollback test removes post-migration files and restores flat credentials |
| CLI entrypoint works through package script | Green | Targeted CLI test and standalone dry-run smoke exit 0 |
| Targeted migration tests pass | Green | 4 pass, 0 fail |
| Full relevant validation passes or blocker documented | Green | Typecheck, lint, docs, full test suite, and build passed |
| Worklog complete | Green | All 11 sections complete |
| Commit created | Green | T222 committed with Lore protocol |
