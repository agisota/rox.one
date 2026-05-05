# Swarm Inventory

Collected at: `2026-05-05T19:32:56Z`

## Repository

| Field | Value |
|---|---|
| Path | `/Users/marklindgreen/Projects/craft/craft` |
| Branch | `main` |
| Head | `72cf3e595feb Close the first worker wave with evidence-backed UI gates` |
| Working tree | dirty during current integration wave; feature changes are evidence-backed and awaiting supervisor commit |
| Origin | `https://github.com/agisota/rox-one-terminal.git` |
| Origin visibility | private (`agisota/rox-one-terminal`) |
| Upstream reference | `craft-origin -> https://github.com/agisota/craft.git` |
| Divergence | `main` ahead of `origin/main` by 30 commits; latest confirmed behind=0 |

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
- Ticket status after current integration wave: `39 DONE`, `9 TODO`
- Worklog files: `65`

Notable drift fixed in T059:

- `T041-experience-layer-system.md` lacked `Status:`.
- `T058-upstream-session-refresh-recovery.md` had detailed evidence under a non-matching worklog slug.
- `T032-github-worktree-integration.md` was too thin for dispatch and had no exact matching worklog.

T059 readiness additions:

- `docs/worklog/T032-github-worktree-integration.md`
- `.swarm/dispatch/T032-github-worktree-integration.md`

Current remaining TODO tickets:

- `T015-multi-agent-pipeline-planner`
- `T016-automation-presets`
- `T018-usage-balance-ledger`
- `T019-structured-logs-history`
- `T020-auth-boundary-cloud-session`
- `T021-team-invites-rbac`
- `T022-s3-storage-quotas`
- `T023-managed-cloud-workspace`
- `T024-local-cloud-sync-mvp`
- `T025-sync-v2-design`
- `T040-final-release-candidate`

Status drift closed after read-only audit:

- `T000-bootstrap-agent-os`
- `T001-repo-cartography`
- `T002-baseline-ci`
- `T031-tdd-mode-task-generation`
- `T033-mac-arm-build`
- `T034-e2e-core-scenario-suite`
- `T035-team-workspace-sharing`

Recently closed after the original T059 snapshot:

- `T013-review-board`
- `T014-validation-gates-engine`
- `T015-multi-agent-pipeline-planner`
- `T016-automation-presets`
- `T017-user-account-cabinet`
- `T026-file-manager-scopes`
- `T027-pdf-viewer`
- `T028-markdown-entity-graph`
- `T029-office-document-adapter`
- `T030-browser-research-integration`
- `T032-github-worktree-integration`
- `T036-team-chat-collaboration`
- `T037-mobile-responsive-web-shell`
- `T038-security-hardening`
- `T039-observability-audit-trail`

## Worktrees

| Path | Branch | Head | State | Recommendation |
|---|---|---|---|---|
| `/Users/marklindgreen/Projects/craft/craft` | `main` | `72cf3e595feb` | dirty during current integration wave, ahead 30 before the next commit | keep; push blocked by runtime approval policy |
| `/Users/marklindgreen/Projects/craft-worktrees/telegram-ru-polish` | `codex/telegram-ru-polish` | `0b5808319503` | pruned from git worktree metadata | no tracked worktree metadata remains; branch archive/deletion is separate |
| `/Users/marklindgreen/Projects/craft/worktrees/T003-white-label-brand-config` | `feature/T003-white-label-brand-config` | `ff82ab1ccd5c` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T004-localization-ru-en` | `feature/T004-localization-ru-en` | `bc8a3fd22a0f` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T005-skill-bundle-installer` | `feature/T005-skill-bundle-installer` | `a129407508ce` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T006-product-mode-registry` | `feature/T006-product-mode-registry` | `daa5bb0fb2e0` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T007-composer-mode-selector-buttons` | `feature/T007-composer-mode-selector-buttons` | `fd0ffb9880d1` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T008-prompt-rewrite-engine` | `feature/T008-prompt-rewrite-engine` | `f9d6c65b78e1` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T009-thinking-partner-round-table` | `feature/T009-thinking-partner-round-table` | `c737bba078d0` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T010-option-graph-schema` | `feature/T010-option-graph-schema` | `008987f7f0a4` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T011-spec-builder-screen` | `feature/T011-spec-builder-screen` | `6e14974eefa9` | clean, merged | keep until archive/prune pass |
| `/Users/marklindgreen/Projects/craft/worktrees/T012-spec-compiler-export` | `feature/T012-spec-compiler-export` | `90792013a410` | clean, merged | keep until archive/prune pass |

Merge proof:

All T003-T012 worktree HEADs are ancestors of `main`.
