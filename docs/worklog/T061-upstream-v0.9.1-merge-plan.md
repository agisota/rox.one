# T061 - Upstream v0.9.1 Merge Plan Worklog

## 1. Task summary

Prepared the protected upstream merge plan for `lukilabs/craft-agents-oss`
`v0.9.1` on branch `mac/upstream-v0.9.1-rox-merge`. No upstream merge was
performed in this ticket.

## 2. Repo context discovered

The current branch is `mac/upstream-v0.9.1-rox-merge`.

Configured remotes:

- `origin`: `https://github.com/agisota/rox-one-terminal.git`
- `craft-origin`: `https://github.com/agisota/craft.git`
- `upstream`: `https://github.com/lukilabs/craft-agents-oss.git`

The authoritative upstream tag is:

```text
b31904c60b3a48f7deb310518e04b9200397af6d refs/tags/v0.9.1
```

`v0.8.12..v0.9.1` contains:

```text
226 files changed, 19723 insertions(+), 1651 deletions(-)
```

Protected ROX-owned surfaces are mostly untouched by upstream when measured
against `v0.8.12..v0.9.1`. The exceptions are settings pages and shared locale
files. Local `HEAD..v0.9.1` is much noisier because the ROX fork has many local
files absent from upstream.

The merge dry-run reports many `changed in both` and conflict markers, so T062
must be a protected conflict-resolution ticket rather than a direct merge.

## 3. Files inspected

- `package.json`
- `docs/tickets/`
- `docs/worklog/`
- `docs/release/`
- `.swarm/`
- `apps/electron/src/renderer/components/workbench/`
- `apps/electron/src/renderer/pages/settings/`
- `apps/electron/src/main/account-api.ts`
- `packages/shared/src/workbench/`
- `packages/shared/src/i18n/`
- `packages/server-core/src/webui/`
- `packages/server-core/src/sync/`

## 4. Tests added first

This is a documentation and merge-control ticket. The red checks were
validation-style checks confirming the T061 ticket/worklog and local upstream
tag were absent before the T061 setup:

```text
ticket-missing
worklog-missing
local-v091-missing
```

## 5. Expected failing test output

Before this ticket was created:

```text
test -f docs/tickets/T061-upstream-v0.9.1-merge-plan.md -> missing
test -f docs/worklog/T061-upstream-v0.9.1-merge-plan.md -> missing
git show-ref refs/tags/v0.9.1 -> missing
```

## 6. Implementation changes

- Added `docs/tickets/T061-upstream-v0.9.1-merge-plan.md`.
- Added `docs/release/upstream-v0.9.1-rox-protected-map.md`.
- Added `docs/worklog/T061-upstream-v0.9.1-merge-plan.md`.
- Updated `.swarm/inventory.md` and `.swarm/backlog-status.md` with the T061
  accounting state.
- Verified upstream remote and fetched `v0.9.1`.
- Recorded protected path impact, conflict risk clusters, and required T062
  validation matrix.
- Did not modify runtime product code.
- Did not perform the final upstream merge.

## 7. Validation commands run

```bash
git status --short --branch
git remote -v
git rev-parse --short v0.9.1
git ls-remote --exit-code --tags https://github.com/lukilabs/craft-agents-oss.git refs/tags/v0.9.1
git diff --name-only v0.8.12..v0.9.1
git diff --shortstat v0.8.12..v0.9.1
git diff --name-only v0.8.12..v0.9.1 -- <protected paths>
git diff --name-only $(git merge-base HEAD v0.9.1)..v0.9.1 -- <build and package paths>
git merge-tree $(git merge-base HEAD v0.9.1) HEAD v0.9.1
bun run validate:agent-contract
bun run validate:docs
git diff --check
```

## 8. Passing test output summary

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 62 tickets, 7 required docs

bun run validate:docs
[agent-contract] ok: 11 skills, 62 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated docs/architecture/sync-v2-design.md

git diff --check
<no output>
```

## 9. Build output summary

No runtime source code changed in T061. Build is deferred to T062 after actual
merge conflict resolution.

## 10. Remaining risks

- T062 is conflict-heavy across build, package, CI, CLI, server runtime, settings,
  and i18n surfaces.
- `events.jsonl` and `.claude/` are local dirty/session artifacts and must not be
  staged into T061/T062.
- Push to the private remote may still be blocked by the current runtime policy
  even though local commits can be created.

## 11. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Upstream remote verified | DONE | `upstream` remote points at `lukilabs/craft-agents-oss.git`. |
| `v0.9.1` tag source verified | DONE | `b31904c60b3a48f7deb310518e04b9200397af6d refs/tags/v0.9.1`. |
| Merge branch prepared outside `main` | DONE | Current branch: `mac/upstream-v0.9.1-rox-merge`. |
| Protected-file map exists | DONE | `docs/release/upstream-v0.9.1-rox-protected-map.md`. |
| Merge strategy documented | DONE | Protected map and T062 rules recorded. |
| Required validation commands documented | DONE | Validation matrix recorded in ticket and release doc. |
| No final upstream merge performed | DONE | Only docs and merge-control artifacts changed. |
