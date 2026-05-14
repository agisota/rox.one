# T347 - RC Scenario S09: Upstream Base Still Passes ROX Custom Flows

## 1. Task Summary

Validate RC Scenario S09: the current upstream base still passes ROX-owned
custom-flow coverage, including C4 storage isolation, RBAC, Experience Layer,
and the protected ROX path list.

## 2. Repo Context Discovered

`T347` is a validation-only Phase 20 ticket. It says to file blocking tickets
for regressions instead of changing runtime behavior in this ticket.

The branch was first based on `66a807aa`, then fast-forwarded to fresh
`origin/main` at `c40f92a1` and `f07636fe`, and then rebased onto code base
`23a91c7e` before recording final evidence because upstream PRs kept landing.
On `23a91c7e`, the shared RC smoke harness registers S01 through S08, but not
`s09-upstream-rox-flows`. `origin/main` advanced again to `e10537ef` after this
validation evidence was captured.

The `plan.md §6.2` protected path list is present, `bun run typecheck` passes,
and `bun run lint` exits zero with warnings. The full `bun test` gate is red:
6367 pass, 13 skip, 181 fail, 2 errors.

## 3. Files Inspected

- `docs/tickets/T347-rc-s09-upstream-base-rox-custom-flows.md`
- `docs/release/2026-05-14-rc-evidence.md`
- `scripts/e2e-smoke.ts`
- `scripts/__tests__/e2e-smoke-harness.test.ts`
- `plan.md`

## 4. Tests Added First

No code test was added in this validation-only ticket. The red validation checks
are the required S09 smoke command and the full `bun test` gate.

## 5. Expected Failing Test Output

Command:

```bash
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
```

Observed failure on `23a91c7e`:

```text
[e2e-smoke] Unsupported scenario "s09-upstream-rox-flows". Supported scenarios: s01-registration, s02-prompt-pipeline, s03-mission-checkpoint, s04-arena-swarm-vdi, s05-team-invite-rbac, s06-file-upload-entity-graph, s07-sync-conflict-resolution, s08-share-session-shortlink
error: script "e2e:smoke" exited with code 1
```

The full suite also failed:

```text
6367 pass
13 skip
181 fail
2 errors
Ran 6561 tests across 554 files. [112.66s]
```

Representative failing clusters include R.9 community-link audit, file RPC
scope handling, session persistence, file audit sink/bootstrap, C4
storage/config migration and scope behavior, user-data/theme persistence,
tenant credential fallback, i18n locale files, label CRUD, resource/session
bundling, workspace skills, large-result guards, default workspace bundle,
Electron storage scope, runtime resolver paths, and backend creation.

## 6. Implementation Changes

- Marked `T347` as `Status: Blocked`.
- Filed blocker ticket `T362-rc-s09-full-gate-and-smoke-harness-repair.md`.
- Updated the RC evidence table row for S09 to `Blocked`.
- Added the S09 blocker to the RC evidence blocker table.

No runtime files were changed.

## 7. Validation Commands Run

```bash
git merge --ff-only origin/main
bun run e2e:smoke -- --scenario s09-upstream-rox-flows
for p in apps/electron/src/renderer/components/workbench apps/electron/src/renderer/pages/settings apps/electron/src/main/account-api.ts packages/shared/src/workbench packages/shared/src/i18n packages/server-core/src/webui packages/server-core/src/sync docs/tickets docs/worklog docs/release .swarm; do test -e "$p" || { printf 'missing %s\n' "$p"; exit 1; }; done; printf 'protected_paths_ok=11\n'
bun run typecheck
bun run lint
bun test
bun run validate:agent-contract
bun run validate:docs
bun run validate:rebrand
bun run validate:roadmap
git diff --check
```

## 8. Passing Test Output Summary

- Protected ROX path list: `protected_paths_ok=11`.
- `bun run typecheck`: pass.
- `bun run lint`: exit 0 with 7 warnings and 0 errors.
- `bun run validate:agent-contract`: `[agent-contract] ok: 11 skills, 323 tickets, 7 required docs`.
- `bun run validate:docs`: agent contract, architecture docs, and sync v2 design validations pass.
- `bun run validate:rebrand`: pass.
- `bun run validate:roadmap`: `validate:roadmap OK — 46 phases, 110 tickets across detail files`.
- `git diff --check`: pass.
- RBAC-adjacent suites observed in the full run pass, including
  `roles.test.ts`, `roles-audit.test.ts`, `rbac-e2e.test.ts`,
  `roles-rate-limit.test.ts`, and `missions-rate-limit.test.ts`.
- Experience Layer RPC coverage observed in the full run passes:
  `packages/server-core/src/handlers/rpc/__tests__/experience-rpc.test.ts`.
- Server-core C4 workspace-scope RPC coverage observed in the full run passes,
  but shared C4 storage/config tests still have failing cases and block S09.

## 9. Build Output Summary

No build was run because this ticket made no runtime/source changes and the
required full test gate is red.

## 10. Remaining Risks

- S09 smoke is not registered in the shared harness.
- Full `bun test` is red on rebased code base `23a91c7e`.
- `origin/main` advanced again to `e10537ef` after the final local validation,
  so T362 should rebase before repair.
- The full-suite failure set is broad and likely needs investigation before it
  can be repaired safely in one atomic change.
- No packaged Electron screenshot/browser-console evidence was captured for
  S09.

## 11. Acceptance Criteria Matrix

| Criterion | Status | Evidence |
|---|---|---|
| `bun test` passes with zero failures on ROX-protected surfaces | Blocked | `bun test` exits 1 with 181 fail and 2 errors |
| `bun run typecheck` passes with zero errors | Pass | `bun run typecheck` exits 0 |
| `bun run lint` passes with zero errors | Pass | `bun run lint` exits 0 with 7 warnings |
| All files in `plan.md §6.2` protected-file list are intact | Pass | Protected-path loop reports `protected_paths_ok=11` |
| C4 tenant isolation tests pass | Blocked | Shared config/credential C4-adjacent tests fail in full suite |
| RBAC policy tests pass | Pass | RBAC suites observed passing in full `bun test` output |
| Experience Layer tests pass | Pass | `experience-rpc.test.ts` observed passing in full `bun test` output |
| Screenshot / terminal output evidence captured and referenced | Blocked | Terminal evidence captured; packaged screenshots pending |
| RC evidence row S09 updated | Pass | `docs/release/2026-05-14-rc-evidence.md` row S09 is `Blocked` |
| Initial blocking ticket filed | Pass | `T362-rc-s09-full-gate-and-smoke-harness-repair.md` |
