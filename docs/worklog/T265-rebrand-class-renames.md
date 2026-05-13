# T265 - Rebrand class renames

## 1. Task summary

Renamed active non-UI Craft-coded identifiers and files to canonical ROX names
while preserving the one-minor `CraftAgentConfig` compatibility alias.

## 2. Repo context discovered

Explorer mapping found the active non-UI surface in shared MCP/OAuth clients,
Pi metadata schema helpers, the bash-pattern sync utility, config validation,
and their server-core callers. The required compatibility exception is the
`CraftAgentConfig` type alias in `packages/shared/src/agent/claude-agent.ts`.

## 3. Files inspected

- `packages/shared/src/mcp/client.ts`
- `packages/shared/src/mcp/mcp-pool.ts`
- `packages/shared/src/mcp/validation.ts`
- `packages/shared/src/auth/oauth.ts`
- `packages/shared/src/sources/credential-manager.ts`
- `packages/pi-agent-server/src/craft-metadata-schema.ts`
- `packages/pi-agent-server/src/craft-metadata-schema.test.ts`
- `packages/pi-agent-server/src/index.ts`
- `packages/shared/src/config/cli-domains.ts`
- `packages/shared/src/config/sync-craft-agent-bash-patterns.ts`
- `packages/shared/src/agent/core/config-validator.ts`
- `packages/server-core/src/handlers/rpc/sources.ts`
- `packages/server-core/src/sessions/SessionManager.ts`
- `packages/server-core/src/sessions/session-manager-helpers.ts`
- `packages/shared/tests/permissions-craft-agent-sync.test.ts`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-code-identifiers.test.ts` with a non-UI
identifier/file invariant. The test asserts:

- legacy `craft-metadata-schema.ts` and `sync-craft-agent-bash-patterns.ts`
  files are absent and canonical replacements exist;
- active source roots contain no legacy non-UI identifiers such as
  `CraftMcpClient`, `CraftOAuth`, `allowCraftMetadataProperties`, or
  `getCraftAgentReadOnlyBashPatterns`;
- `CraftAgentConfig` remains only as a deprecated alias with explicit
  `remove in v1.1.0` guidance.

## 5. Expected failing test output

`bun test scripts/__tests__/rebrand-code-identifiers.test.ts` failed before
implementation because the legacy non-UI filenames still existed:

```text
error: legacy non-UI file names should be renamed

- []
+ [
+   "packages/pi-agent-server/src/craft-metadata-schema.ts",
+   "packages/shared/src/config/sync-craft-agent-bash-patterns.ts",
+ ]
```

## 6. Implementation changes

- Renamed Pi metadata schema source/test files to
  `rox-agent-metadata-schema.ts` and `rox-agent-metadata-schema.test.ts`.
- Renamed Pi metadata helpers to `allowRoxAgentMetadataProperties` and
  `stripRoxAgentMetadata`.
- Renamed `CraftMcpClient` to `RoxMcpClient` and updated shared/server-core
  callers.
- Renamed `CraftOAuth` to `RoxOAuth` and updated credential-manager callers.
- Renamed bash-pattern sync internals to `getRoxAgentReadOnlyBashPatterns`,
  `syncRoxAgentPatterns`, and `isRoxAgentPattern`.
- Renamed config validator helper to `isRoxAgentConfig`.
- Updated the shared package script to `sync:agent-bash-patterns`.
- Kept `CraftAgentConfig` as the only compatibility alias with explicit
  deprecation-removal JSDoc.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-code-identifiers.test.ts`
- `bun test packages/pi-agent-server/src/rox-agent-metadata-schema.test.ts`
- `bun test packages/shared/tests/permissions-craft-agent-sync.test.ts`
- `bun test packages/shared/src/auth/__tests__/oauth.test.ts packages/shared/src/auth/__tests__/oauth-relay.test.ts`
- `bun test packages/shared/tests/mcp-pool.test.ts`
- `bun run typecheck`
- `bun run lint`
- `git diff --check`

## 8. Passing test output summary

- Rebrand regression: 2 pass, 0 fail, 8 expect calls.
- Pi metadata schema: 6 pass, 0 fail, 25 expect calls.
- Permissions sync: 1 pass, 0 fail, 1 expect call.
- OAuth/OAuth relay: 66 pass, 0 fail, 81 expect calls.
- MCP pool: 7 pass, 0 fail, 24 expect calls.
- Typecheck: exit 0.
- Lint: exit 0.
- Diff check: exit 0.

## 9. Build output summary

Not run for this individual ticket. R.2 final validation will run full
`bun test` and `bun run build` after T266 lands.

## 10. Remaining risks

The `craft-agent` CLI command strings and package names are intentionally
unchanged in this ticket because later rebrand phases own CLI/package/env-var
renames.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Red test proves non-UI identifier gap | Green | `bun test scripts/__tests__/rebrand-code-identifiers.test.ts` failed on legacy filenames before implementation |
| Source files/imports use canonical names | Green | Rebrand regression now passes and `rg` found no targeted legacy identifiers in active source roots |
| Deprecated `CraftAgentConfig` alias exists | Green | Regression test checks alias plus `remove in v1.1.0` JSDoc |
| Validation evidence recorded | Green | Targeted tests, typecheck, lint, and diff check recorded above |
| Worklog complete | Green | This 11-section worklog is complete |
| Commit created | Green | Included in this ticket commit |
