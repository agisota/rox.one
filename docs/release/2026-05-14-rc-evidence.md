# RC Evidence — Phase 20 Run Log

**Release:** v1.0.0-rc.1 (target)
**Phase:** 20 — Release Candidate Validation
**Run date:** 2026-05-14 (TBD — filled in during manual smoke testing)
**Executor:** (TBD)
**Build commit SHA:** (TBD)
**Electron version:** (TBD)
**macOS version (for S10):** (TBD)

## Overview

This document is the **evidence skeleton** for Phase 20. Each row maps to one RC
scenario ticket. Columns are populated during the manual smoke run that executes
the ten scenarios end-to-end on a clean Electron build.

Status values: `Pass` | `Fail` | `Blocked` | `Skipped`

A scenario marked `Fail` or `Blocked` must reference a blocking ticket filed
under its own `docs/tickets/T###-*.md` before Phase 20 can be declared complete.

Phase 20 is the final gate before Phase 21 (v1.0.0 release). All ten scenarios
must reach `Pass` status before the `v1.0.0-rc.1` tag is pushed.

---

## Scenario Results

| # | Scenario | Ticket | Status | Build SHA | Timestamp (UTC) | Notes |
|---|----------|--------|--------|-----------|-----------------|-------|
| S01 | Registration → multi-tenant login flow | [T339](../tickets/T339-rc-s01-multi-tenant-registration.md) | `Blocked` | — | `2026-05-13T23:01:02Z` | [T352](../tickets/T352-rc-e2e-smoke-harness-script.md) resolves the missing script. Current `bun run e2e:smoke -- --scenario s01-registration` reaches the harness and exits code 78 because S01 requires `darwin` while this host is `linux`. Account-session unit tests pass; no packaged S01 build was run on this host. |
| S02 | Raw prompt → Rewrite → Spec → TDD → Review | [T340](../tickets/T340-rc-s02-prompt-pipeline-flow.md) | `Blocked` | `fc162c4c` | `2026-05-13T23:05:00Z` | [T353](../tickets/T353-rc-s02-smoke-harness-and-command-repair.md) resolves the unsupported scenario and stale command paths. Current `bun run e2e:smoke -- --scenario s02-prompt-pipeline` passes 46 tests; screenshot/browser-console evidence is still pending. |
| S03 | 24h mission → checkpoint → final verification | [T341](../tickets/T341-rc-s03-mission-checkpoint-verification.md) | `Blocked` | `29b276dc` | `2026-05-13T23:14:32Z` | [T354](../tickets/T354-rc-s03-smoke-harness-and-command-repair.md) resolves the unsupported S03 smoke scenario and stale Mission Control UI glob. Current `bun run e2e:smoke -- --scenario s03-mission-checkpoint` passes 156 tests; packaged restart screenshot/browser-console evidence is still pending. |
| S04 | Arena swarm → dedupe signals → Review Board → VDI update | [T342](../tickets/T342-rc-s04-arena-swarm-vdi-update.md) | `Blocked` | `8bf05c4e` | `2026-05-13T23:19:20Z` | [T355](../tickets/T355-rc-s04-smoke-harness-and-command-repair.md) resolves the unsupported S04 smoke scenario and stale swarm/VDI validation paths. Current `bun run e2e:smoke -- --scenario s04-arena-swarm-vdi` passes 42 tests; packaged screenshot/browser-console evidence is still pending. |
| S05 | Team invite → shared workspace → RBAC check | [T343](../tickets/T343-rc-s05-team-invite-rbac.md) | `Blocked` | `1abf54f2` | `2026-05-13T23:24:45Z` | [T356](../tickets/T356-rc-s05-smoke-harness-registration.md) resolves the unsupported S05 smoke scenario. Current `bun run e2e:smoke -- --scenario s05-team-invite-rbac` passes 161 tests; packaged screenshot/browser-console evidence is still pending. |
| S06 | File upload → entity graph → source link | [T344](../tickets/T344-rc-s06-file-upload-entity-graph.md) | `Blocked` | `3070640a` | `2026-05-13T23:30:03Z` | [T357](../tickets/T357-rc-s06-smoke-harness-and-command-repair.md) resolves the unsupported S06 smoke scenario and stale file/entity graph validation paths. Current `bun run e2e:smoke -- --scenario s06-file-upload-entity-graph` passes 30 tests; packaged screenshot/browser-console evidence is still pending. |
| S07 | Sync push/pull → conflict → explicit resolution | [T345](../tickets/T345-rc-s07-sync-conflict-resolution.md) | `Blocked` | `bbda8e2d` | `2026-05-13T23:37:38Z` | [T358](../tickets/T358-rc-s07-smoke-harness-and-command-repair.md) resolves the unsupported S07 smoke scenario and stale sync validation glob. Current `bun run e2e:smoke -- --scenario s07-sync-conflict-resolution` passes 23 tests with 4 todo markers; packaged screenshot/browser-console evidence is still pending. |
| S08 | Share session → public shortlink opens | [T346](../tickets/T346-rc-s08-share-session-shortlink.md) | `Blocked` | `6de3ea36` | `2026-05-13T23:42:41Z` | [T359](../tickets/T359-rc-s08-smoke-harness-and-command-repair.md) resolves the unsupported S08 smoke scenario and stale shortlink/share validation globs. Current `bun run e2e:smoke -- --scenario s08-share-session-shortlink` passes 20 tests; packaged screenshot/browser-console evidence is still pending. |
| S09 | Upstream base still passes ROX custom flows | [T347](../tickets/T347-rc-s09-upstream-base-rox-custom-flows.md) | `Blocked` | `303b0b05` | `2026-05-14T00:31:03Z` | [T362](../tickets/T362-rc-s09-full-gate-and-smoke-harness-repair.md) registers `s09-upstream-rox-flows`; current S09 smoke passes 325 tests across 32 files. [T364](../tickets/T364-rc-rebased-cheatsheet-shadow-lint-repair.md) restores lint after the rebase. Full `bun test` still exits 1 with 181 failures and 2 errors, split to [T363](../tickets/T363-rc-s09-full-suite-shared-fixture-repair.md). |
| S10 | Mac ARM build opens and smoke passes | [T348](../tickets/T348-rc-s10-mac-arm-build-smoke.md) | `Todo` | — | — | |

---

## Screenshots

Screenshots are captured during the manual smoke run and stored in
`docs/release/screenshots/2026-05-14-rc/` (one subfolder per scenario).

- `s01/` — Registration flow, post-restart home screen
- `s02/` — Composer pipeline progression frames
- `s03/` — Mission Control checkpoint timeline, final verification status
- `s04/` — Arena swarm signal list, Review Board, HUD VDI indicator
- `s05/` — Team settings invite form, workspace access, RBAC denial feedback
- `s06/` — File upload confirmation, entity graph, source-link navigation
- `s07/` — Sync conflict modal, resolution confirmation
- `s08/` — Share status indicator, shortlink URL in clipboard, public viewer page
- `s09/` — Full test suite terminal output (pass/fail summary)
- `s10/` — `codesign --verify` output, app launch screen on Mac ARM

---

## Blocker Tickets

If any scenario produces a blocker, the new ticket is listed here:

| Scenario | Blocker Ticket | Description | Status |
|----------|---------------|-------------|--------|
| S01 | [T352](../tickets/T352-rc-e2e-smoke-harness-script.md) | Missing root `e2e:smoke` script blocked the required RC smoke harness entry point; script now reaches an explicit host-environment blocker. | DONE |
| S02 | [T353](../tickets/T353-rc-s02-smoke-harness-and-command-repair.md) | S02 was not registered in `e2e:smoke`, and T340 targeted validation commands pointed at stale paths; both are repaired. | DONE |
| S03 | [T354](../tickets/T354-rc-s03-smoke-harness-and-command-repair.md) | S03 was not registered in `e2e:smoke`, and T341's Mission Control UI command pointed at a stale glob; both are repaired. | DONE |
| S04 | [T355](../tickets/T355-rc-s04-smoke-harness-and-command-repair.md) | S04 was not registered in `e2e:smoke`, and T342 pointed at stale swarm/VDI test paths; both are repaired. | DONE |
| S05 | [T356](../tickets/T356-rc-s05-smoke-harness-registration.md) | S05 was not registered in `e2e:smoke`; targeted RBAC, policy, scope-forgery, and adjacent account-team/settings tests now run through the harness. | DONE |
| S06 | [T357](../tickets/T357-rc-s06-smoke-harness-and-command-repair.md) | S06 was not registered in `e2e:smoke`, and T344 pointed at stale file/entity graph test paths; both are repaired. | DONE |
| S07 | [T358](../tickets/T358-rc-s07-smoke-harness-and-command-repair.md) | S07 was not registered in `e2e:smoke`, and T345 pointed at a stale sync test glob; both are repaired. | DONE |
| S08 | [T359](../tickets/T359-rc-s08-smoke-harness-and-command-repair.md) | S08 was not registered in `e2e:smoke`, and T346 pointed at stale shortlink/share test globs; both are repaired. | DONE |
| S09 | [T362](../tickets/T362-rc-s09-full-gate-and-smoke-harness-repair.md) | S09 smoke harness registration is repaired and targeted S09 smoke passes; full suite remains red and is split to T363. | BLOCKED |
| S09 | [T363](../tickets/T363-rc-s09-full-suite-shared-fixture-repair.md) | Full `bun test` remains red on code base `303b0b05` with 6404 pass, 13 skip, 181 failures, and 2 errors across shared fixtures and runtime contracts. | TODO |
| S09 | [T364](../tickets/T364-rc-rebased-cheatsheet-shadow-lint-repair.md) | Rebased keyboard cheatsheet overlay used disallowed `shadow-sm`; `shadow-xs` restores lint without weakening the shadow-token rule. | DONE |

---

## Phase 20 Completion Gate

All of the following must be true before the RC sign-off PR is opened:

- [ ] All 10 scenarios have `Pass` status in the table above
- [ ] All screenshot folders under `docs/release/screenshots/2026-05-14-rc/` are
      populated
- [ ] Zero open blocker tickets
- [ ] `bun run validate:agent-contract` passes on the RC commit
- [ ] `bun run validate:docs` passes on the RC commit
- [ ] CI is green on the RC branch

Once the gate is green, open the RC sign-off PR that bumps `package.json.version`
to `1.0.0-rc.1` and tags `v1.0.0-rc.1`.
