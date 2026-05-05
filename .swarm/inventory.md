# Swarm Inventory

Collected at: `2026-05-05T18:36:44Z`

## Repository

| Field | Value |
|---|---|
| Path | `/Users/marklindgreen/Projects/rox/rox` |
| Branch | `main` |
| Head | `3030bb2d1247 Make audit evidence queryable before worker expansion` |
| Working tree | clean after T039 commit; dirty only when updating swarm control docs |
| Origin | `https://github.com/agisota/rox-one-terminal.git` |
| Origin visibility | private (`agisota/rox-one-terminal`) |
| Upstream reference | `rox-origin -> https://github.com/agisota/rox.git` |
| Divergence | `main` ahead of `origin/main` by 27 commits before fresh fetch |

## Validation Surface

No `mise.toml` was found. `package.json` is the active project task surface.

Important scripts:

- `bun run validate:agent-contract`
- `bun run validate:dev`
- `bun run validate:ci`
- `bun run validate:architecture-docs`
- `bun run lint`
- `bun test`
- `bun run typecheck`
- `bun run typecheck:electron`
- `bun run e2e:core`
- `bun run electron:smoke`

## Tickets and Worklogs

Live counts:

- Real ticket files: `48` plus `TEMPLATE.md`
- Ticket status: `22 DONE`, `26 TODO`
- Worklog files: `64`

Notable drift fixed in T059:

- `T041-experience-layer-system.md` lacked `Status:`.
- `T058-upstream-session-refresh-recovery.md` had detailed evidence under a non-matching worklog slug.
- `T032-github-worktree-integration.md` was too thin for dispatch and had no exact matching worklog.

T059 readiness additions:

- `docs/worklog/T032-github-worktree-integration.md`
- `.swarm/dispatch/T032-github-worktree-integration.md`

Current remaining TODO tickets from audit:

- `T000-bootstrap-agent-os`
- `T001-repo-cartography`
- `T002-baseline-ci`
- `T013-review-board`
- `T014-validation-gates-engine`
- `T015-multi-agent-pipeline-planner`
- `T016-automation-presets`
- `T017-user-account-cabinet`
- `T018-usage-balance-ledger`
- `T019-structured-logs-history`
- `T020-auth-boundary-cloud-session`
- `T021-team-invites-rbac`
- `T022-s3-storage-quotas`
- `T023-managed-cloud-workspace`
- `T024-local-cloud-sync-mvp`
- `T025-sync-v2-design`
- `T026-file-manager-scopes`
- `T027-pdf-viewer`
- `T028-markdown-entity-graph`
- `T029-office-document-adapter`
- `T030-browser-research-integration`
- `T031-tdd-mode-task-generation`
- `T033-mac-arm-build`
- `T034-e2e-core-scenario-suite`
- `T035-team-workspace-sharing`
- `T040-final-release-candidate`

Recently closed after the original T059 snapshot:

- `T032-github-worktree-integration`
- `T036-team-chat-collaboration`
- `T037-mobile-responsive-web-shell`
- `T038-security-hardening`
- `T039-observability-audit-trail`

## Worktrees

| Path | Branch | Head | State | Recommendation |
|---|---|---|---|---|
| `/Users/marklindgreen/Projects/rox/rox` | `main` | `3030bb2d1247` | clean after T039, ahead 27 before fetch | keep, push after gate |
| `/Users/marklindgreen/Projects/rox-worktrees/telegram-ru-polish` | `codex/telegram-ru-polish` | `0b5808319503` | prunable | prune after confirmation/gate |
| `/Users/marklindgreen/Projects/rox/worktrees/T003-white-label-brand-config` | `feature/T003-white-label-brand-config` | `ff82ab1ccd5c` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T004-localization-ru-en` | `feature/T004-localization-ru-en` | `bc8a3fd22a0f` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T005-skill-bundle-installer` | `feature/T005-skill-bundle-installer` | `a129407508ce` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T006-product-mode-registry` | `feature/T006-product-mode-registry` | `daa5bb0fb2e0` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T007-composer-mode-selector-buttons` | `feature/T007-composer-mode-selector-buttons` | `fd0ffb9880d1` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T008-prompt-rewrite-engine` | `feature/T008-prompt-rewrite-engine` | `f9d6c65b78e1` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T009-thinking-partner-round-table` | `feature/T009-thinking-partner-round-table` | `c737bba078d0` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T010-option-graph-schema` | `feature/T010-option-graph-schema` | `008987f7f0a4` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T011-spec-builder-screen` | `feature/T011-spec-builder-screen` | `6e14974eefa9` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/rox/worktrees/T012-spec-compiler-export` | `feature/T012-spec-compiler-export` | `90792013a410` | clean, merged | keep until archive/prune pass |

Merge proof:

All T003-T012 worktree HEADs are ancestors of `main`.
