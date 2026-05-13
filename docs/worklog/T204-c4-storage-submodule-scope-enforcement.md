# T204 - C4 storage submodule scope enforcement

## 1. Task summary

Wire the eight storage submodules through the branded resolver and narrow scoped parameters to `BrandedWorkspaceScope`.

## 2. Repo context discovered

- T203 added `getConfigDirForScope()` and runtime breach checks.
- All public storage submodule functions already accept `_scope = DEFAULT_LOCAL_SCOPE`, but the scope is mostly unused.
- Storage explorer mapped direct `getConfigDir()` calls in `storage-io`, `storage-drafts`, `storage-themes`, and `storage-tool-icons`, plus indirect flat helpers in `storage-internal`.
- Omitted-scope callers still compile while defaults remain, so explicit caller migration is a separate ticket.

## 3. Files inspected

- `packages/shared/src/config/storage-io.ts`
- `packages/shared/src/config/storage-settings.ts`
- `packages/shared/src/config/storage-workspaces.ts`
- `packages/shared/src/config/storage-conversations.ts`
- `packages/shared/src/config/storage-drafts.ts`
- `packages/shared/src/config/storage-themes.ts`
- `packages/shared/src/config/storage-llm-connections.ts`
- `packages/shared/src/config/storage-tool-icons.ts`
- `packages/shared/src/config/storage-internal.ts`
- `packages/shared/src/config/__tests__/storage-scope.test.ts`

## 4. Tests added first

- Extended `packages/shared/src/config/__tests__/storage-scope.test.ts` with a real `setSessionDraft()` write under a branded workspace scope. The test asserts the write lands at `<configDir>/tenants/W42/drafts.json` and not at flat `<configDir>/drafts.json`.
- Added a compile-time `@ts-expect-error` check that an unbranded local scope literal cannot be passed to `setSessionDraft()`.

## 5. Expected failing test output

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts` failed before implementation because the draft still wrote to the flat root:
  - `expect(received).toBe(expected)`
  - expected `true`, received `false`
- `bun run typecheck` failed before implementation because the unbranded-call `@ts-expect-error` was unused, proving the old API still accepted structural scope literals.

## 6. Implementation changes

- Narrowed the eight storage submodule scope parameters from `WorkspaceScope` to `BrandedWorkspaceScope`.
- Routed shared storage path helpers in `storage-internal.ts` through `getConfigDirForScope(scope)`.
- Propagated `_scope` through `storage-io`, `storage-settings`, `storage-workspaces`, `storage-conversations`, `storage-drafts`, `storage-themes`, `storage-llm-connections`, and `storage-tool-icons`.
- Changed config-default sync memoization from a single boolean to a per-scoped-defaults-file `Set`, so tenant stores can initialize their own defaults without changing the local default behavior.
- Kept every public storage function defaulted to `DEFAULT_LOCAL_SCOPE`, preserving the existing single-user flat layout.

## 7. Validation commands run

- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts` (expected fail before implementation)
- `bun run typecheck` (expected fail before implementation)
- `bun test packages/shared/src/config/__tests__/storage-scope.test.ts`
- `bun test packages/shared/src/config/__tests__/storage-scope-auth.test.ts packages/shared/src/config/__tests__/storage-scope-runtime.test.ts`
- `bun run typecheck`
- `git diff --check`

## 8. Passing test output summary

- `storage-scope.test.ts`: 10 pass, 0 fail, 13 expects.
- `storage-scope-auth.test.ts` + `storage-scope-runtime.test.ts`: 19 pass, 0 fail, 38 expects.
- `bun run typecheck`: passed.
- `git diff --check`: passed.

## 9. Build output summary

Not run for this ticket. Runtime build is reserved for the final C4 validation gate after caller and RPC wiring are complete.

## 10. Remaining risks

- Explicit caller migration remains pending under a separate ticket.
- Demo RPC handler wiring remains pending under a separate ticket.
- ADR 0007 and the final lint/full-test/build gate remain pending.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| `setSessionDraft` writes tenant-prefixed with branded workspace scope | Pass | `storage-scope.test.ts` tenant write test |
| Unbranded scope literals fail typecheck at storage call sites | Pass | Typecheck first failed on unused `@ts-expect-error`, then passed after narrowing |
| Eight scoped storage submodules accept `BrandedWorkspaceScope` | Pass | Updated storage submodule signatures |
| Direct storage-root helpers use `getConfigDirForScope()` | Pass | `storage-internal.ts`, `storage-io.ts`, drafts/themes/tool-icons helpers |
| Existing auth/runtime/resolver tests pass | Pass | 29 focused tests pass across scope/auth/runtime |
| Tests pass | Pass | Targeted tests and typecheck pass |
| Worklog complete | Pass | This 11-section worklog is updated with evidence |
| Commit created | Pass | This ticket commit |
