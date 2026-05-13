# T345 - User data migration PR120 fixture alignment

Status: DONE
Phase: post-rebase focused-test repair
Ticket: docs/tickets/T345-user-data-migration-pr120-fixture-alignment.md

## 1. Task summary

Align the user-data migration priority fixture with the current PR #120
contract after the focused validation bundle exposed a stale T340 expectation.

## 2. Repo context discovered

PR #120 fixed the migration conflict guard so `.rox` can safely be both the
new root and a lower-priority legacy source when `.rox-agent` is the selected
higher-priority source. The current `origin/main` fixture sets `newRoot` to
`.rox` and expects its `config.json` to be overwritten with `.rox-agent` data.

The rebased T340 commit still carried the older `.rox-new` destination in the
priority fixture, so the test expected the lower-priority `.rox` file to be
overwritten even though that path was no longer the destination. Runtime code
already matched PR #120; only the fixture was stale.

## 3. Files inspected

- `packages/shared/src/config/__tests__/user-data-migration.test.ts`
- `packages/shared/src/config/user-data-migration.ts`
- PR #120 commit diff

## 4. Tests added first

No new test file was needed. The existing focused migration test is the
contract.

## 5. Expected failing test output

The focused bundle failed in
`migrateUserDataIfNeeded > Priority: ~/.rox-agent/ is preferred over ~/.rox/ when both exist`:

- expected `{"from":"rox-agent"}` in the lower-priority `.rox` path
- received `{"from":"rox"}` because the stale fixture used `.rox-new` as the
  destination

## 6. Implementation changes

- Restored the priority fixture destination to `join(sandbox, '.rox')`.
- Left migration runtime code unchanged.

## 7. Validation commands run

- focused C4/rebrand/credential/observability bundle (red)
- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`
- focused C4/rebrand/credential/observability bundle
- `bun run typecheck`
- `bun run lint`
- `bun test`
- `bun run build`
- `git diff --check`

## 8. Passing test output summary

- `bun test packages/shared/src/config/__tests__/user-data-migration.test.ts`:
  5 pass, 0 fail, 60 expect calls.
- Focused C4/rebrand/credential/observability bundle:
  168 pass, 0 fail, 442 expect calls across 16 files.
- `bun run typecheck`: exit 0.
- `bun run lint`: exit 0 with 3 existing React hook warnings and 0 errors.
- `bun test`: 5988 pass, 13 skip, 0 fail, 1 snapshot, 24614 expect calls.
- `git diff --check`: clean.

## 9. Build output summary

`bun run build` exited 0 after the final validation pass. This ticket changes
only a test fixture; migration runtime code was unchanged.

## 10. Remaining risks

No known remaining migration fixture drift.

## 11. Acceptance criteria matrix

| Acceptance criterion | Status | Evidence |
| --- | --- | --- |
| User-data migration focused test passes | Green | `user-data-migration.test.ts`: 5 pass, 0 fail |
| Runtime migration code unchanged | Green | `user-data-migration.ts` has no diff |
| Worklog complete | Green | Final validation evidence recorded |
| Commit created | Green | Atomic commit after validation |
