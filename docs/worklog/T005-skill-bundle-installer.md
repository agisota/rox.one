# T005 — Default workspace + bundled skill packs installer

## 1. Task summary

Implemented the Agent Workbench starter bundle installer for new/fresh workspaces.

The bundle installs:

- 10 curated workspace skill packs.
- Workbench statuses: Inbox, Clarifying, Planned, Running, Needs Review, Needs Fix, Verified, Done, Archived.
- Workbench valued label bases for `mode::*`, `priority::*`, `artifact::*`, `validation::*`, and `scope::*`.

The installer is idempotent and does not overwrite existing workspace skill edits.

## 2. Repo context discovered

- Workspace creation is centralized in `packages/shared/src/workspaces/storage.ts`.
- Workspace skills live at `{workspaceRoot}/skills/{slug}/SKILL.md`.
- Statuses live in `{workspaceRoot}/statuses/config.json` and must preserve repo-required fixed statuses.
- Labels live in `{workspaceRoot}/labels/config.json`.
- Existing resource bundle tests use real temporary filesystem workspaces, so T005 follows the same pattern.

## 3. Files inspected

- `packages/shared/src/workspaces/storage.ts`
- `packages/shared/src/skills/storage.ts`
- `packages/shared/src/skills/types.ts`
- `packages/shared/src/statuses/storage.ts`
- `packages/shared/src/statuses/types.ts`
- `packages/shared/src/labels/storage.ts`
- `packages/shared/src/labels/types.ts`
- `packages/shared/src/resources/__tests__/resource-bundle.test.ts`
- `packages/shared/src/skills/__tests__/storage.test.ts`

## 4. Tests added first

Added:

- `packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts`

Coverage:

- Manifest has stable skill/status/label entries.
- Empty workspace receives skill packs, statuses, and labels.
- Installer can run twice without duplicates.
- Existing user-edited skill is preserved.
- `createWorkspaceAtPath` seeds the bundle automatically.

## 5. Expected failing test output

Initial red run:

```text
error: Cannot find module '../default-workspace-bundle.ts'
0 pass
1 fail
```

Intermediate failure after implementation:

```text
[loadStatusConfig] Invalid config: missing required fixed statuses, returning defaults
Expected: true
Received: false
```

Fix: status installation now starts from `getDefaultStatusConfig()` when no status config exists, preserving required repo fixed statuses before adding Workbench statuses.

## 6. Implementation changes

- Added `packages/shared/src/workbench/default-workspace-bundle.ts`.
- Added `installDefaultWorkbenchBundle(rootPath)`.
- Added stable exported constants for skill slugs, status IDs, and required valued label entries.
- Added `createWorkspaceAtPath` hook to install the Workbench bundle after existing workspace seed steps.
- Installer writes missing skill packs only; existing `SKILL.md` files are skipped.
- Installer merges statuses and labels by stable ID without overwriting existing entries.

## 7. Validation commands run

```text
bun install
bun test packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts
bun test packages/shared/src/workbench/__tests__/default-workspace-bundle.test.ts packages/shared/src/skills/__tests__/storage.test.ts packages/shared/src/resources/__tests__/resource-bundle.test.ts packages/shared/src/workspaces/__tests__/storage-permission-mode-normalization.test.ts
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
```

## 8. Passing test output summary

```text
5 pass
0 fail
70 expect() calls
```

Relevant regression suite:

```text
90 pass
0 fail
810 expect() calls
```

## 9. Build output summary

No desktop/web build artifact was produced for T005 because this task only changes shared workspace bootstrap behavior.

Build/type gates passed:

- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `git diff --check`

## 10. Remaining risks

- T005 does not install automation presets yet; that is reserved for T016.
- Skill pack content is intentionally starter-level and contract-focused; later mode tasks can specialize prompts further.
- Existing workspaces are not auto-migrated on app startup yet; T005 seeds new workspace creation and provides a repair/install function future UI/maintenance code can call.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Fresh workspace receives bundled skills/statuses/labels | Pass | `seeds the bundle during workspace creation` test |
| Existing workspace can install/repair bundle | Pass | empty workspace install test |
| Installer is safe and idempotent | Pass | second install test |
| Existing user skill is not overwritten | Pass | user-edited `prompt-rewriter-pack` preservation test |
| Tests pass | Pass | targeted + regression test runs |
| Worklog complete | Pass | this file |
