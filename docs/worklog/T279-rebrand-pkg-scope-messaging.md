# T279 - Rebrand messaging package scopes

## 1. Task summary

Rename the messaging gateway and WhatsApp worker workspace package scopes from
`@rox-agent/*` to `@rox-one/*`.

## 2. Repo context discovered

- Phase R.5.7 follows the landed session MCP server package rename.
- Direct `rg` found `@rox-agent/messaging-gateway` and
  `@rox-agent/messaging-whatsapp-worker` in package metadata, runtime
  imports, comments that name canonical packages, and `bun.lock`.
- No tsconfig path mappings currently reference either messaging package scope.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `packages/messaging-gateway/package.json`
- `packages/messaging-whatsapp-worker/package.json`
- `apps/electron/package.json`
- `apps/electron/src/main/index.ts`
- `apps/electron/src/main/logger.ts`
- `packages/server/package.json`
- `packages/server/src/index.ts`
- `packages/messaging-gateway/src/adapters/whatsapp/index.ts`
- `bun.lock`

## 4. Tests added first

Extended `scripts/__tests__/rebrand-package-scope.test.ts` before
implementation. The T279 test asserts:

- messaging gateway package metadata uses `@rox-one/messaging-gateway`;
- WhatsApp worker package metadata uses
  `@rox-one/messaging-whatsapp-worker`;
- app/server workspace dependencies use `@rox-one/messaging-gateway`;
- messaging gateway depends on `@rox-one/messaging-whatsapp-worker`;
- active `apps/`, `packages/`, and `bun.lock` files no longer contain the
  two legacy messaging package scopes;
- `bun.lock` contains both ROX package scopes after the rename.

## 5. Expected failing test output

Red run:

- Command: `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- Result: exit 1.
- Expected failure: `packages/messaging-gateway/package.json` still reported
  `@rox-agent/messaging-gateway` while the test expected
  `@rox-one/messaging-gateway`.

## 6. Implementation changes

- Renamed `packages/messaging-gateway/package.json` package name to
  `@rox-one/messaging-gateway`.
- Renamed `packages/messaging-whatsapp-worker/package.json` package name to
  `@rox-one/messaging-whatsapp-worker`.
- Updated app/server imports, workspace dependencies, and active package-scope
  comments to the two ROX messaging package scopes.
- Ran `bun install` to refresh `bun.lock`.

## 7. Validation commands run

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`
- `bun test packages/messaging-gateway/src/__tests__/registry.test.ts`
- `bun install`
- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `bun run validate:rebrand`
- `bun run build`
- Post-commit `bun test`
- Pre-commit dirty-tree attempt: `bun test` failed only in the dependency
  risk register guard because `apps/electron/package.json` and `bun.lock`
  were intentionally modified but not yet committed. The post-commit full
  suite passed on the clean committed tree.

## 8. Passing test output summary

- `bun test scripts/__tests__/rebrand-package-scope.test.ts`: 7 pass, 0 fail,
  71 assertions.
- `bun test packages/messaging-gateway/src/__tests__/registry.test.ts`: 12
  pass, 0 fail, 42 assertions.
- `bun install`: exit 0; lockfile saved, 3 packages installed.
- `bun install --frozen-lockfile`: exit 0.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0.
- `bun run validate:agent-contract`: exit 0; 11 skills, 200 tickets, and 7
  required docs passed.
- `bun run validate:docs`: exit 0; agent contract, architecture docs, and
  sync-v2 design validators passed.
- `git diff --check`: exit 0.
- `bun run validate:rebrand`: expected exit 1 with 3289 forbidden token
  findings reserved for later rebrand phases.
- Post-commit `bun test`: 5103 pass, 13 skip, 0 fail, 1 snapshot, 13000
  assertions across 462 files.

## 9. Build output summary

- `bun run build`: exit 0; package builds and Electron main, preload,
  renderer, resources, and assets builds completed.

## 10. Remaining risks

- The rest of R.5 package-scope renames remain intentionally untouched, so
  whole-repo rebrand validation stays expected-red at 3289 remaining findings.
- Remote GitHub checks may still fail to start while the account billing lock
  is active; local validation is the authoritative evidence for this sub-phase.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Ticket exists before code changes | Pass | T279 ticket and worklog created first |
| Red test proves messaging package-scope gap | Pass | Red exit 1 on legacy messaging gateway package name before implementation |
| Messaging gateway package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| WhatsApp worker package metadata uses ROX scope | Pass | R.5 package-scope regression test passes |
| Active imports and dependencies use ROX scopes | Pass | R.5 package-scope regression test and targeted grep pass |
| Lockfile is refreshed | Pass | `bun install` saved `bun.lock` with the ROX scopes |
| Full suite passes | Pass | Post-commit `bun test`: 5103 pass, 13 skip, 0 fail |
| Build passes | Pass | `bun run build`: exit 0 |
| Validation evidence recorded | Pass | Sections 7-9 list command and output summaries |
| Worklog complete | Pass | All 11 required sections are complete |
| Commit created | Pass | Commit `ec560cd` created before final documentation amend |
