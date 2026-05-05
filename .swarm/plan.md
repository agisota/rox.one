# Agent Workbench Suite Swarm Plan

## 1. Phase Contract

Every phase has a gate. Do not move to the next phase without evidence.

| Phase | Goal | Gate |
|---|---|---|
| DISCOVER | Establish repo/ticket/worklog/worktree truth | `.swarm/inventory.md` current and validated |
| PLAN | Define target, dispatch model, QA gates | `.swarm/spec.md` and this plan committed |
| ORGANIZE | Normalize metadata, archive/prune safely, push private main | clean status, private remote verified, scoped commit/push |
| EXECUTE | Implement remaining tickets through bounded workers | each ticket has red/green/worklog/commit |
| VERIFY | Produce release-candidate proof | E2E, smoke, security, build, release notes |

## 2. Current Gate Status

| Gate | Status | Evidence |
|---|---:|---|
| Repo inventory | DONE | `main`, clean baseline, private origin, scripts discovered |
| Ticket/worklog audit | DONE | 48 tickets, 57 worklogs, drift identified |
| Worktree audit | DONE | T003-T012 clean and merged; one prunable stale entry |
| Swarm control docs | DONE | T059 creates `.swarm/*` |
| Critic gate | DONE | Re-check passed after concrete T032 packet and safe git rules |
| Private push | PENDING | `main` is ahead 27 before fresh fetch; push only after private remote and behind=0 proof |

## 3. Execution Waves

### Wave 0 - Recovery and Control Plane

Tickets:

- `T059-swarm-project-recovery-plan`

Deliverables:

- `.swarm/config.json`
- `.swarm/spec.md`
- `.swarm/plan.md`
- `.swarm/inventory.md`
- normalized T041/T058 metadata
- scoped commit and private push

Validation:

- `bun run validate:agent-contract`
- `git diff --check`
- `git status --short --branch`

### Wave 1 - Backlog Truth and Git Worktree System

Tickets:

- `T032-github-worktree-integration`

Dispatch packet:

- `.swarm/dispatch/T032-github-worktree-integration.md`

Required ordering:

1. Red lane: write parser/classifier/policy/staging tests and confirm expected failure.
2. Implementation lane: implement the smallest helper/policy layer that passes the red tests.
3. Verification lane: run targeted shared tests, agent-contract, diff-check, and inspect git status.
4. Documentation lane: update T032 worklog acceptance matrix.

Parallelization rule:

- Red lane is blocking. Implementation may not start in parallel with red-test creation.
- Documentation can run in parallel only after red output exists and must not edit implementation files.

Gate:

- no dirty worktree before/after worker run
- no feature branch deleted unless merged and explicitly classified
- private origin still `agisota/rox-one-terminal`
- no force-push
- exact staging allowlist used before commit

### Wave 2 - Team, Mobile, Security, Observability

Tickets:

- `T036-team-chat-collaboration`
- `T037-mobile-responsive-web-shell`
- `T038-security-hardening`
- `T039-observability-audit-trail`

Status:

- DONE on `main` through `3030bb2 Make audit evidence queryable before worker expansion`.

Parallel lanes:

- UI lane write scope: team chat components, responsive shell components, component tests.
- Security lane write scope: shared/server RBAC policy modules and security tests.
- Audit lane write scope: audit event schema/store adapters/log redaction tests.
- E2E lane write scope: fake-provider scenarios and viewport smoke tests.

Parallelization rule:

- Shared schemas and route registries are single-owner files per wave.
- Tests for each lane must be committed in the same ticket branch before implementation code is accepted.

Gate:

- security tests for non-member denial, viewer restrictions, cross-team isolation
- mobile core flow has no horizontal overflow
- audit redaction tests pass

### Wave 3 - Remaining Product System

Tickets:

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

Parallel lanes:

- Product workflow lane: T013-T016.
- Account/cloud/storage lane: T017-T025.
- Files/knowledge/research lane: T026-T030.
- Engineering/release infrastructure lane: T031/T033/T034/T035.

Gate:

- each lane starts with ticket/worklog red tests and bounded write scopes
- shared schemas and app shell remain single-owner per wave
- no real external providers in tests
- no feature ticket can claim DONE without targeted validation and Lore commit

### Wave 4 - Bootstrap Metadata Reconciliation

Tickets:

- `T000-bootstrap-agent-os`
- `T001-repo-cartography`
- `T002-baseline-ci`

Gate:

- inspect existing commits/worklogs before changing status
- if implementation already exists, normalize metadata only with evidence
- if gaps remain, create scoped dispatch packets instead of silently marking DONE

### Wave 5 - Release Candidate

Tickets:

- `T040-final-release-candidate`

Gate:

- `bun run validate:ci`
- targeted E2E scenario: Rewrite -> Spec -> Review -> Experience mission evidence
- Electron smoke/build proof
- release notes, user guide, known limitations

### Wave 6 - Product Gap Fixes From Screenshots

Create explicit tickets before implementation for any remaining UX/product gaps:

- Account cabinet personalization and auth-state truth repair.
- Public session share shortlink flow.
- Experience Layer visual/game/arena polish beyond current T057.
- Prompt-to-spec screen parity against the original wireframes.

Gate:

- each new bug/feature gets ticket + worklog + screenshots/manual acceptance.

## 4. Worker Dispatch Template

```text
Ticket:
Phase:
Objective:
Write scope:
Forbidden scope:
Files to inspect first:
Tests to add first:
Expected red output:
Implementation constraints:
Validation commands:
Worklog path:
Commit requirement:
Evidence required in final worker report:
```

## 5. Supervisor Rules

- Dispatch independent lanes in parallel only when write scopes do not overlap.
- Keep shared files (`package.json`, shared schemas, app shell, global CSS, route registry) under one owner per wave.
- Treat screenshots and browser proof as evidence, not decoration.
- Use fake deterministic providers in tests.
- Do not start Wave 2 until Wave 1 has committed or explicitly declared blockers.
- Do not claim release readiness while repo-wide gates have known unrelated failures.

## 6. Immediate Next Actions

1. Commit this swarm inventory refresh after `git diff --check` and agent-contract validation.
2. Run fresh `git fetch origin main`, verify private origin and behind=0, then push `main` to private `origin`.
3. Reconcile T000-T002 metadata against existing bootstrap/worklog evidence.
4. Dispatch Wave 3 as bounded parallel worker lanes with non-overlapping write scopes.
5. Run Wave 5 `T040-final-release-candidate` only after remaining product/system tickets are either DONE or explicitly deferred with risk notes.

## 7. Safe Git and Push Rules

Before any commit:

- `git status --short --branch`
- exact file allowlist review
- `git diff --check`
- relevant validators/tests
- Lore commit message with `Tested:` and `Not-tested:`

Before any push:

- `gh repo view agisota/rox-one-terminal --json isPrivate,nameWithOwner,visibility` must report private
- `git remote get-url origin` must be `https://github.com/agisota/rox-one-terminal.git`
- `git fetch origin main`
- `git rev-list --left-right --count origin/main...main` must show `behind=0`
- use normal `git push origin main`
- never use `--force` or `--force-with-lease` in supervisor automation

Before any prune/archive:

- prove branch head is ancestor of `main`
- prove worktree is clean or prunable metadata only
- record recommendation in inventory
- pruning remains a separate ORGANIZE action, not part of T032 implementation
