# Upstream v0.9.1 ROX Protected Merge Map

Date: 2026-05-06

Branch: `mac/upstream-v0.9.1-rox-merge`

Upstream source:

- Remote: `https://github.com/lukilabs/craft-agents-oss.git`
- Tag: `v0.9.1`
- Tag commit: `b31904c60b3a48f7deb310518e04b9200397af6d`

## Current Remote State

| Remote | URL | `v0.9.1` status | Notes |
|---|---|---:|---|
| `origin` | `https://github.com/agisota/rox-one-terminal.git` | missing | Private ROX target remote. |
| `craft-origin` | `https://github.com/agisota/craft.git` | missing | Existing private Craft mirror remote. |
| `upstream` | `https://github.com/lukilabs/craft-agents-oss.git` | present | Authoritative upstream for this merge. |

## Upstream Base Diff

Comparison: `v0.8.12..v0.9.1`

Summary:

```text
226 files changed, 19723 insertions(+), 1651 deletions(-)
```

Upstream changed 226 file paths between `v0.8.12` and `v0.9.1`.

## Protected Path Impact

Protected path impact is measured against `v0.8.12..v0.9.1`, not against local
`HEAD`, because local `HEAD` contains ROX-owned files that do not exist upstream.

| Protected surface | Upstream changes in `v0.8.12..v0.9.1` | T062 rule |
|---|---|---|
| `apps/electron/src/renderer/components/workbench/` | none | Preserve local Workbench UI, Prompt Lab, Spec Builder, Review Gate, and Experience entry points. |
| `apps/electron/src/renderer/pages/settings/` | `AiSettingsPage.tsx`, `MessagingSettingsPage.tsx` | Merge upstream settings changes without removing ROX account cabinet, localization, and auth UX. |
| `apps/electron/src/main/account-api.ts` | none | Preserve ROX account proxy and session/auth bridge. |
| `packages/shared/src/workbench/` | none | Preserve ROX workbench schemas, mode registry, validation gates, and Experience truth model. |
| `packages/shared/src/i18n/` | `de`, `en`, `es`, `hu`, `ja`, `pl`, `zh-Hans` locale JSON files | Merge upstream locale updates and preserve `ru` plus ROX-specific keys. Run i18n parity. |
| `packages/server-core/src/webui/` | none | Preserve account/team/billing/storage/sync webui contracts. |
| `packages/server-core/src/sync/` | none | Preserve sync contracts and conflict rules. |
| `docs/tickets/` | none | Preserve ROX backlog accounting. |
| `docs/worklog/` | none | Preserve implementation evidence. |
| `docs/release/` | none | Preserve release/snapshot docs and this merge map. |
| `.swarm/` | none | Preserve inventory/backlog coordination state. |

## Merge Dry-Run Risk Matrix

`git merge-tree $(git merge-base HEAD v0.9.1) HEAD v0.9.1` reports many
`changed in both` and conflict markers. T062 must be treated as a conflict-heavy
merge, not a mechanical fast-forward.

| Risk cluster | Evidence | Risk | T062 handling |
|---|---|---:|---|
| CI and build workflow | `.github/workflows/validate.yml`, `.github/workflows/validate-server.yml` changed upstream and locally | high | Merge intentionally, keep ROX validation jobs, then run `validate:ci`. |
| Package graph and lockfile | `package.json`, `bun.lock`, `apps/electron/package.json`, shared/server package files changed | high | Resolve once, run install/build/typecheck/test matrix, avoid unrelated dependency churn. |
| CLI/provider surfaces | `apps/cli/package.json`, `apps/cli/src/index.ts` changed | medium | Preserve upstream provider additions while keeping ROX runtime behavior. |
| Server runtime and Docker | `Dockerfile.server`, `.dockerignore` changed | medium | Preserve ROX server-core contracts and update build packaging only with validation. |
| Settings/i18n | Settings pages and locale JSON changed | medium | Keep ROX account/settings UX and run `lint:i18n:parity`. |
| ROX product layers | Workbench, Experience, account, sync docs exist only locally | high | Never take upstream wholesale over protected paths; compare file-by-file. |

## Required T062 Validation Matrix

Run after conflict resolution:

```bash
bun run validate:agent-contract
bun run validate:docs
bun run typecheck:all
bun test
bun run lint:i18n:parity
bun run e2e:core
bun run electron:build
git diff --check
```

## T062 Merge Rules

1. Do not merge upstream into `main`.
2. Use branch `mac/upstream-v0.9.1-rox-merge`.
3. Resolve conflicts path-by-path, starting with package/build/CI surfaces.
4. Preserve ROX-owned Workbench, Experience Layer, account, sync, release docs,
   and Russian localization.
5. Treat upstream i18n updates as additive unless a key conflict is proven.
6. Do not mark T062 done until the required validation matrix is green or a
   precise blocker is written to the T062 worklog.
7. Do not stage runtime logs, caches, `.claude/session`, or unrelated artifacts.
