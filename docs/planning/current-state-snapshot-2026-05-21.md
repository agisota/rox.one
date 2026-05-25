# Current-state snapshot — 2026-05-21

> **WT-00 deliverable** per spec
> `docs/superpowers/specs/2026-05-21-wt-00-snapshot-hygiene-design.md` (FR-00.1).
> This snapshot pins the Wave-0 baseline for all 40+ parallel worktrees.

## 1. Repository

- **Default branch:** `main`
- **Wave-0 baseline SHA:** `fac6f228069c` (per `wt-meta/wt-00.yaml`)
- **WT-00 branch SHA (this PR base):** `bc816645d` (orchestrator scaffold commit)
- **Active worktree branches (Wave 0):** 16 — `chore/snapshot-2026-05-21`,
  `feat/release-engineering-3m`, `feat/data-platform-electron-shell`, …
  See `wt-meta/wt-{00..16}.yaml` for the canonical list.
- **Active release tag:** `v1.0.6` (last shipped to users; see `release-notes/`).
- **Recently merged PRs:** #401, #402, #403, #404 (Wave-0 mission-control
  scaffolds + dispatch-wave-0 orchestrator).

## 2. Linear (PZD-* project)

- **Live in-flight stories:** PZD-112..123 (Wave-0 spec / dispatch ladder).
- **Closed in last 7 days:** PZD-78..84 (PR #349, #355) — Open Design Phase-1.
- **Backlog:** ~40 stories awaiting Wave-1 dispatch once WT-00 lands.
- **Meta project:** "ROX.ONE GitHub Roadmap Sync" (label `wt-process`).

## 3. Featurebase

| Board | Status |
|---|---|
| Roadmap | 5 boards live; v2-bootstrap post `wt-00-snapshot-hygiene-rotation` queued as Planned. |
| Bugs, Fixes, Improvements (`6a0db0b911b1b8507c8e8165`) | Active; WT-00 post will flip Planned → Shipped on merge. |
| Changelog | Last entry `v1.0.6` (Rox Design payload bundled in Mac DMG, PZD-84). |

## 4. Pre-flight gates (`bun run rc:preflight`)

- **Locally runnable:** 8/16 (per the rc:preflight cascade memo).
- **Remote-only (CI):** 8/16 — release-all-platforms-workflow,
  cross-platform-launch, mac-diag-smoke, linux-installer-launcher,
  private-release-pipeline, audit-smoke, i18n parity/coverage, and the bun-test
  run on Ubuntu CI.
- **Status as of base SHA:** 16/16 green on the most recent CI rev for
  `release/v1.0.3-launch-fixes`.

## 5. Open HIGH issues (from 2026-05-20 PR #268 audit + carry-over)

| # | Title | Owner | ETA | Linear |
|---|---|---|---|---|
| 1 | Mac DMG signing pipeline still ad-hoc (no DevID cert) | release-engineering | v1.1.0 | PZD-65 |
| 2 | Windows MSI unsigned beta (SmartScreen warning) | release-engineering | v1.1.0 | PZD-66 |
| 3 | RTL tests pre-existing fails (apps/electron vitest) | ui-shell | deferred → v1.1.0 | PZD-67 |
| 4 | Skill bundle hot-reload race on macOS | agent-runtime | Wave-1 | (open) |
| 5 | Featurebase Bugs board duplicate-post detection | knowledge-ops | Wave-1 | (open) |

No HIGHs block Wave 0 dispatch.

## 6. Scaffold-extension queue (snapshot)

WT-00 owns the following shared scaffolds (see `wt-meta/scaffold-ownership.yaml`):

- `package.json`, `apps/electron/package.json`, `tsconfig*.json`, root `AGENTS.md`, `bun.lock`.

Open scaffold-extension requests landed in this PR (see also `docs/worklog/WT-00.md`):

- **From WT-04 PR #409 (User + Identity contract):**
  - Add `"./core": "./src/core/index.ts"` to `packages/shared/package.json` exports map (deferred until WT-04 lands; the path is reserved so consumers can import `@rox-one/shared/core` without re-publishing).
  - Verify tsconfig path aliases resolve `@rox-one/shared/core` — already covered by the existing `paths` rule.

## 7. EN mirror (краткий)

This snapshot fixes the Wave-0 baseline for the 16-WT parallel harness. SHA
`fac6f228069c` is the agreed merge-base for every WT; rebases off any later
commit must round-trip through a fresh scaffold-extension review. WT-00 ships
hygiene + ownership maps + a `bun run snapshot-verify` CLI so siblings can
self-check before opening a PR.

---

## Verification

- `wt-meta/scaffold-ownership.yaml` — owners present for `package.json`,
  `tsconfig.json`, `tsconfig.base.json`, all CI workflows, cross-cutting
  registries.
- `wt-meta/release-cuts.yaml` — 5 cuts (foundation, data, ui, sharing, ai)
  in topological order; no cyclic include refs.
- `scripts/orchestrator/snapshot-verify.ts` — `bun run scripts/orchestrator/snapshot-verify.ts --json` exits 0 from this SHA.
- Test coverage: 20 unit tests in `scripts/orchestrator/__tests__/snapshot-verify.test.ts`.

## Sign-off

Snapshot frozen 2026-05-21. Next snapshot trigger: completion of Wave 1 merges
(target Q3 2026-06-15) or any hotfix changing the scaffold-ownership table.
