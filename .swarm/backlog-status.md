# Backlog Status After Read-Only Audit

Collected at: `2026-05-05T20:09:00Z`

## Summary

The remaining roadmap is not 26 blank tickets. The audit found three categories:

1. **Status drift only**: tickets already have PASS worklogs and implementation evidence, but ticket metadata still said `TODO`.
2. **Partial core implemented**: tickets have modules and tests, but lack the integration surface, runtime wiring, UI flow, or final acceptance proof required for `DONE`.
3. **True release-candidate TODO**: T040 has no matching worklog and must remain blocked until the release gate is real.

## Ticket State Matrix

| Group | Tickets | State | Required next action |
|---|---|---|---|
| Bootstrap/status drift | `T000`, `T001`, `T002` | Metadata closed to `DONE` | Keep evidence in matching worklogs; no feature work. |
| Product workflow closed | `T013`, `T014`, `T015`, `T016` | `DONE` | Review Board, Validation Gates, pipeline preview, and automation preset consumer are covered by tests. |
| Account/cloud/storage | `T018`-`T023` | `PARTIAL_CORE` | Replace or wrap in-memory seams with durable/provider adapters, then close API/security/sync acceptance. |
| Account closed | `T017` | `DONE` | User-centered account cabinet and stale auth-required feedback suppression are covered by tests. |
| Explicit sync MVP | `T024` | `DONE` | Pure sync engine now has account/team guarded workspace sync HTTP routes and deterministic service tests. |
| Sync V2 design | `T025` | `DONE` | Checked design contract exists and is enforced by `validate:sync-v2-design` / `validate:docs`. |
| Files/knowledge/research closed | `T026`, `T027`, `T028`, `T029`, `T030` | `DONE` | File scope RPC denial, PDF overlay, graph edge cases, Office fake converter injection, and browser research factory gating are covered by deterministic tests. |
| Engineering/status drift | `T031`, `T033`, `T034`, `T035` | Metadata closed to `DONE` | Preserve PASS evidence in worklogs; do not reopen unless gates regress. |
| Release candidate | `T040` | `TODO` | Create worklog, run release gates, produce release notes, then close. |

## Worktree State

| Worktree area | State | Action |
|---|---|---|
| `/Users/marklindgreen/Projects/rox/worktrees/T003-*` through `T012-*` | clean, merged to `main` / `origin/main` | Keep until explicit archive/removal pass. |
| `/Users/marklindgreen/Projects/rox-worktrees/telegram-ru-polish` | pruned from git worktree metadata | No further action unless the branch itself needs archive/deletion. |
| `/Users/marklindgreen/Projects/rox/rox` | `main`, dirty during T024 sync-API integration, ahead of private origin by 32 commits before the next commit | Push remains blocked by runtime approval policy, not by repo divergence. |

## Execution Order

1. `W3-account-cloud-storage`: close `T020 -> T018/T019/T021/T022 -> T023`.
2. `W4-metadata-release`: keep already-closed metadata tickets closed, then run `T040`.

## Supervisor Rule

No ticket in `PARTIAL_CORE` may be marked `DONE` by status edit alone. It needs a fresh targeted test or smoke proving the missing integration surface, updated worklog, and a Lore commit.

`T025` is not part of that partial-core group: it is a design/validation ticket with a complete worklog, architecture document, and fresh `validate:sync-v2-design` evidence.
