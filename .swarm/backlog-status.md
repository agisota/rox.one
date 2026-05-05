# Backlog Status After Read-Only Audit

Collected at: `2026-05-05T18:57:00Z`

## Summary

The remaining roadmap is not 26 blank tickets. The audit found three categories:

1. **Status drift only**: tickets already have PASS worklogs and implementation evidence, but ticket metadata still said `TODO`.
2. **Partial core implemented**: tickets have modules and tests, but lack the integration surface, runtime wiring, UI flow, or final acceptance proof required for `DONE`.
3. **True release-candidate TODO**: T040 has no matching worklog and must remain blocked until the release gate is real.

## Ticket State Matrix

| Group | Tickets | State | Required next action |
|---|---|---|---|
| Bootstrap/status drift | `T000`, `T001`, `T002` | Metadata closed to `DONE` | Keep evidence in matching worklogs; no feature work. |
| Product workflow | `T013`, `T014`, `T015`, `T016` | `PARTIAL_CORE` | Add integration consumers: board screen, evidence gate endpoint, pipeline launcher, automation preset caller. |
| Account/cloud/storage | `T017`-`T025` | `PARTIAL_CORE` | Replace or wrap in-memory seams with durable/provider adapters, then close UI/API acceptance. |
| Files/knowledge/research | `T026`-`T030` | `PARTIAL_CORE` | Close runtime/UI wiring gaps around file scopes, PDF controls, graph edge cases, Office conversion injection, browser research policy. |
| Engineering/status drift | `T031`, `T033`, `T034`, `T035` | Metadata closed to `DONE` | Preserve PASS evidence in worklogs; do not reopen unless gates regress. |
| Release candidate | `T040` | `TODO` | Create worklog, run release gates, produce release notes, then close. |

## Worktree State

| Worktree area | State | Action |
|---|---|---|
| `/Users/marklindgreen/Projects/rox/worktrees/T003-*` through `T012-*` | clean, merged to `main` / `origin/main` | Keep until explicit archive/removal pass. |
| `/Users/marklindgreen/Projects/rox-worktrees/telegram-ru-polish` | pruned from git worktree metadata | No further action unless the branch itself needs archive/deletion. |
| `/Users/marklindgreen/Projects/rox/rox` | `main`, clean, ahead of private origin by 29 commits | Push remains blocked by runtime approval policy, not by repo divergence. |

## Execution Order

1. `W3-product-workflow`: close integration gaps for `T014 -> T013 -> T015/T016`.
2. `W3-account-cloud-storage`: close `T020 -> T017 -> T018/T019/T021/T022 -> T023 -> T024 -> T025`.
3. `W3-files-knowledge-research`: close `T026 -> T029 -> T027 -> T028 -> T030`, with `T027` allowed in parallel.
4. `W4-metadata-release`: keep already-closed metadata tickets closed, prune stale worktree metadata only after gate, then run `T040`.

## Supervisor Rule

No ticket in `PARTIAL_CORE` may be marked `DONE` by status edit alone. It needs a fresh targeted test or smoke proving the missing integration surface, updated worklog, and a Lore commit.
