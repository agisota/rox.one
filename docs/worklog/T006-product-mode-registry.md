# T006 — Product mode registry

## 1. Task summary

Added a typed Agent Workbench product mode registry for:

- rewrite
- think
- spec
- plan
- build
- review
- verify
- board
- tdd
- research

The registry maps product modes to i18n labels, skills, agent roles, permission compatibility, default validation gates, UI panel config, and output artifact types. Chat/session execution behavior is unchanged.

## 2. Repo context discovered

- Permission/autonomy modes already exist in `packages/shared/src/agent/mode-types.ts` as `safe`, `ask`, and `allow-all`.
- Runtime permission enforcement already lives in `packages/shared/src/agent/mode-manager.ts`; ProductMode only declares compatibility and does not replace that layer.
- Workbench starter skill pack slugs already live in `packages/shared/src/workbench/default-workspace-bundle.ts`.
- i18n parity requires every new EN key to exist in all locale JSON files.

## 3. Files inspected

- `packages/shared/src/agent/mode-types.ts`
- `packages/shared/src/i18n/index.ts`
- `packages/shared/src/i18n/__tests__/workbench-brand-localization.test.ts`
- `packages/shared/src/i18n/__tests__/locale-parity.test.ts`
- `packages/shared/src/workbench/default-workspace-bundle.ts`

## 4. Tests added first

Added:

- `packages/shared/src/workbench/__tests__/product-mode-registry.test.ts`

Coverage:

- All product mode IDs exist once.
- Registry entries validate through `ProductModeSchema`.
- Every mode has label/description i18n keys.
- EN/RU translations resolve for every mode.
- Rewrite mode resolves prompt rewrite skill/agent/gate/artifact defaults.
- Review and TDD include expected validation gates.
- Permission compatibility is enforced.
- User-selected skills/agents/gates are deduplicated.

## 5. Expected failing test output

Initial red run:

```text
error: Cannot find module '../product-mode-registry.ts'
0 pass
1 fail
```

Intermediate dependency hydration failure:

```text
error: Cannot find package 'i18next'
error TS2688: Cannot find type definition file for 'bun'
```

Fix: ran `bun install` in the T006 worktree before repeating validation.

## 6. Implementation changes

- Added `packages/shared/src/workbench/product-mode-registry.ts`.
- Added typed schemas for `ProductMode`, `ValidationGate`, `ArtifactType`, and `ProductAgentRole`.
- Added `getProductModeRegistry`, `getProductMode`, `isPermissionModeAllowedForProductMode`, and `resolveProductModeExecutionConfig`.
- Added `workbench.modes.<mode>.label` and `workbench.modes.<mode>.description` to all locale files.
- Russian translations were added for `ru`; other non-English locales use English fallback copy to preserve parity until full translation pass.

## 7. Validation commands run

```text
bun install
bun test packages/shared/src/workbench/__tests__/product-mode-registry.test.ts
bun test packages/shared/src/workbench/__tests__/product-mode-registry.test.ts packages/shared/src/i18n/__tests__/locale-parity.test.ts packages/shared/src/i18n/__tests__/locale-registry.test.ts
bun run typecheck:shared
bun run typecheck:electron
bun run validate:agent-contract
bun run validate:docs
git diff --check
```

## 8. Passing test output summary

Targeted registry/i18n validation:

```text
79 pass
0 fail
235 expect() calls
```

## 9. Build output summary

No desktop/web artifact was produced for T006 because this is a shared registry/data-contract change.

Build/type gates passed:

- `bun run typecheck:shared`
- `bun run typecheck:electron`
- `git diff --check`

## 10. Remaining risks

- T006 only declares mode execution configuration; it does not wire modes into composer UI or chat execution. That starts in T007.
- Non-Russian/English locales intentionally use English fallback strings for new mode copy until a full translation pass.
- Agent role IDs are product-level registry roles, not yet bound to native Codex/OMX subagent execution.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Mode registry exists | Pass | `product-mode-registry.ts` |
| All required modes are registered | Pass | registry ID test |
| Each mode has EN/RU i18n labels | Pass | i18n test |
| Resolver returns expected skills/gates | Pass | rewrite/review/tdd tests |
| Permission compatibility is enforced | Pass | resolver rejection test |
| Tests pass | Pass | targeted registry/i18n validation |
| Worklog complete | Pass | this file |
