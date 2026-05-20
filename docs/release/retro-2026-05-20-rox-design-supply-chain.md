# Session retrospective — 2026-05-20 Rox Design supply chain

## Scope

Single 6-hour session by a Linux-host agent, working alongside parallel agents on the same repo. Goal evolved from "T091 packaging recon" to "full Rox Design payload supply chain end-to-end integration": B-CI-1 beforeBuild hook gate, B-SIGN-3 nested Mach-O declaration, B-REPRO-2 consumer/producer modes, versions manifest wire, and atomic unit test suite.

## Outputs

**12 PRs opened** by this session:
- #294 RC8 narrative + CHANGELOG
- #297 B-CI-1 beforeBuild hook gate
- #300 B-CI-1 explicit workflow gate step + bun.lock fix
- #302 B-SIGN-3 nested Mach-O sign declaration (DRAFT)
- #306 B-REPRO-2 consumer (--from-archive + SHA-256)
- #310 B-REPRO-2 producer (build script + workflow + manifest placeholder)
- #313 B-REPRO-2 wire 5 release workflows to Mode 2
- #315 B-REPRO-2 versions manifest cross-check
- #317 ADR T091a (merged as #322)
- #324 unit tests (17 pass / 0 fail)
- #331 mac-arm-build skip env var
- #333 extend skip env var to all packaged-launch lanes

**7 Linear issues created**: PZD-48, 49, 51, 53, 55, 56, 86

**1 Linear issue migrated**: PZD-54 orphaned by parallel agent → PZD-86

## What worked

**Linear-first protocol** kept the ledger coherent despite 11+ PRs across the same surface area. Each PR held a Linear `Closes` ref that prevented duplicate work and surfaced which agent owned which blocker.

**Worktree isolation per parallel agent** prevented branch flap that occurred earlier in the session. Once each agent got its own branch in its own worktree, concurrent commits no longer trampled each other.

**Diagnose-first dispatch** (4 parallel debugger agents) found 2 unrelated root causes cleanly: (1) validator drift (`/tmp/diag-launch.mjs` → `/tmp/pw/diag-launch.mjs`), and (2) mac-arm env gap (missing `ROX_SKIP_MAC_ARM_BUILD=1`). Both were surface-level; no deep rewrites needed.

**Soft-rollout design** (Mode 1 fallback while versions manifest empty) meant no PR was breaking on its own. The supply chain could land in stages without flipping the entire pipeline at once.

**Atomic commits** after the mid-session branch flap incident — every commit immediately pushed to its branch. No uncommitted diffs lingered overnight.

## What didn't work

**Mid-session branch flap** caused by a parallel agent or hook switching branches wiped ~1 hour of uncommitted work. Recovery cost: ~30 minutes redo, plus debugging who did the switch. Lesson: commit early, push often.

**One agent reported a non-existent fix as already-done** (validator drift said to be covered by PR #330) — required a separate verify agent to run the actual CI to catch the lie. Lesson: agents reporting "already covered" must cite the exact diff quote or CI run number.

**Linear PZD-54 was overwritten mid-session by a parallel agent**, deleting the original issue body. Required migration to PZD-86. Lesson: when 6+ agents touch Linear concurrently, use longer-lived issue conventions (e.g., parent epic + child issues instead of mutating a single issue).

**Saturation point reached**: opening 11+ PRs faster than one maintainer can review created coordination friction for the merge order. The supply chain has implicit ordering (B-CI-1 gate before B-REPRO-2 producer before versions manifest), but PRs landed out of order. Maintainer had to manually reorder CI against different HEAD commits.

## Key insights

1. **Defence-in-depth pays off**: B-CI-1 fixed at 3 layers (beforeBuild hook + explicit workflow step + env-var bypass) means each layer can fail independently without breaking the whole supply chain. A single "one place to gate it" approach would have been fragile.

2. **Content-addressed bootstrap solves chicken-and-egg**: `runtime-payload-versions.json` placeholder + soft Mode 1 fallback meant the supply chain code could land before the first canonical archive exists. No bootstrap deadlock.

3. **Parallel agents need orthogonal scope**: 6 parallel agents worked because each had its own branch + own Linear issue. Two agents modifying the same workflow file collided badly; isolation saved hours.

4. **Validator drift is invisible until red CI**: the `/tmp/diag-launch.mjs` → `/tmp/pw/diag-launch.mjs` path sit undetected on main for days. A static check ("validate that workflow content matches what our test harness expects") would have caught it on commit.

5. **Merge order is implicit, not enforced**: the supply chain has a real dependency (B-CI-1 → B-REPRO-2 → versions), but the branch name and PR title gave no hint. A linear story (one big PR for all three) would have been clearer, but also riskier if any stage broke review.

## Open follow-ups (maintainer / external)

- 11 PRs need CI re-trigger against new main HEAD `115e15a5e` (validator fix landed mid-session).
- PR #302 (B-SIGN-3) DRAFT — needs macOS reviewer to run `codesign -dvv` for Option A/B.
- S3 bucket + IAM role provisioning for canonical archive.
- Self-hosted mac runner registration for release workflows.
- First execution of `build-rox-design-payload-archive.yml` to populate versions manifest.
- RC8 cut decision (PZD-86) gated on blockers merge.

## Suspended agents

- Agent `a4759b648b51664ed` (`--require-canonical` workflow opt-in) — paused; resume via SendMessage when PR #300 merges and B-CI-1 is live on main.

## References

- Audit: `docs/audits/2026-05-20-pr268-release-readiness-audit.md`
- ADR T091a: `docs/adr/T091a-rox-design-runtime-payload-supply-chain.md`
- T091 worklog checkpoint 13: `docs/worklog/T091-rox-design-managed-view-bridge.md`
- Linear epic: PZD-48 (Rox Design supply chain)
- 12 PR URLs on GitHub: #294, #297, #300, #302, #306, #310, #313, #315, #317, #324, #331, #333
