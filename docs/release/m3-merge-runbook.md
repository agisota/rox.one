# M.3 — Upstream `v0.9.3` Merge Runbook

**Date:** 2026-05-14 | **Audience:** Codex `/goal` mode or human operator
**Spine phase:** M.3 | **Prep audit:** `docs/release/m3-upstream-merge-audit.md`
**Closeout ticket cluster:** see §9

Step-by-step recipe for Phase M.3 of the ROX.ONE v1.0.0 spine. Assumes the
prep audit has been read; keep audit §6 (backup) and §7 (validation
matrix) open in a second pane.

## 1. Pre-conditions (all green before Step 2)

Stop and report at the first failure.

| Pre-condition | Check command |
| --- | --- |
| R.0–R.10 closed | `grep -c "^rebrand-R\." .swarm/master-roadmap-log.md` |
| M.1.x closed (M.1.1–M.1.7) | `grep "M.1.7\|T223" .swarm/master-roadmap-log.md` |
| M.2 RBAC slice 6 closed | `grep "M.2-T229\|M.2-T227" .swarm/master-roadmap-log.md` |
| Critical M.7/M.14 on main | `grep "M.7-T240\|M.14-T245" .swarm/master-roadmap-log.md` |
| Rebrand lint green | `bun run validate:rebrand` |
| Roadmap coherence green | `bun run validate:roadmap` |
| Working tree clean | `git status --porcelain` (empty) |
| On `origin/main` HEAD | `git rev-parse --verify @{u}` |
| Upstream remote configured | `git remote get-url upstream` |
| No active `/goal` run | `ls .omc/state/sessions/ 2>/dev/null \| wc -l` |
| No open PR on `chore/upstream-*` | `gh pr list --state open --head 'chore/upstream-*'` |

If any check fails, document the gap in the merge ticket's worklog §5
and resume only after it closes.

## 2. Backup pass (mandatory)

```bash
git switch main && git pull --ff-only origin main
git tag -a pre-m3-upstream-v0.9.3 -m "Pre-M.3 upstream v0.9.3 merge backup"
git push origin pre-m3-upstream-v0.9.3
git push origin main:backup/pre-m3-$(date -u +%Y%m%d-%H%M%S)
mkdir -p .omc/state
git ls-files -z | xargs -0 rg -c -F -e '@rox-one/' -e 'ROX_' -e 'rox-cli' \
  -e 'RoxAppIcon' > .omc/state/rox-inventory.pre-m3.txt
```

Gate: both push lines succeed; inventory file non-empty. Use `.omc/state/`,
**not** `/tmp` — operator rule forbids `/tmp` writes.

## 3. Branch and fetch upstream

```bash
git fetch upstream --tags
git switch -c chore/upstream-v0.9.3-rox-merge
git diff --stat v0.8.12..upstream/v0.9.3 > .omc/state/m3-upstream-diff.txt
```

Gate: diff file lists 200+ paths (v0.9.1 was 226). If suspiciously small,
upstream remote is wrong — stop.

## 4. Conflict classification

For every path in `.omc/state/m3-upstream-diff.txt`:

1. Classify **ROX-owned** (audit §4 + `plan.md §6.2`) vs **upstream-owned**.
2. ROX-owned: capture the upstream change as a diff, re-apply manually
   after the merge on top of the ROX version.
3. Upstream-owned: accept upstream, then translate any `ROX_*` /
   `rox-one` / `CraftAgent*` survival via the audit §8 pattern card.

Protected paths (per `plan.md §6.2`):

```
apps/electron/src/renderer/components/workbench/
apps/electron/src/renderer/pages/settings/
apps/electron/src/main/account-api.ts
packages/shared/src/workbench/
packages/shared/src/i18n/
packages/server-core/src/{webui,sync}/
docs/{tickets,worklog,release}/
.swarm/
```

Gate: every path on the diff is classified before the merge starts.

## 5. Execute the merge

```bash
git merge --no-ff upstream/v0.9.3
```

Resolve in this order (matches the master-roadmap goal §M.3 ordering):

1. Dependency updates (`package.json`, `bun.lock`).
2. Upstream bugfixes (minimal ROX overlap).
3. Session / auth changes (cross-check audit §4.1 RBAC).
4. Shell / renderer changes (cross-check audit §4.3 UI).

After each resolved file:

```bash
bun run validate:rebrand
bun run typecheck:all   # for .ts/.tsx
git add <resolved-file>
```

Gate: `validate:rebrand` exits 0 after every staged file. A forbidden
token slipping through must be fixed inline before the next stage.

## 6. Re-apply ROX surfaces

After all upstream conflicts are resolved, re-apply patterns the merge
may have eroded:

- **i18n parity:** `bun run lint:i18n:parity`; fill missing keys per
  audit §4.2.
- **Env-var shim:** for each new `ROX_*`, append one-line mapping to
  `packages/shared/src/config/env-shim.ts` and one row to
  `docs/release/rebrand-mapping-2026-05-13.md`.
- **Package scope:** `rg -F '@rox-one/' --type ts --type json` should
  return zero; patch every surviving import.
- **Identifiers:** `CraftAgent*` → `RoxAgent*` with a one-version alias
  only in `@rox-one/shared` and `@rox-one/server-core` (R.5 rule).
- **Brand text:** every `ROX.ONE` literal → `ROX.ONE`.

## 7. Validation matrix (audit §7 full suite)

```bash
bun run validate:rebrand
bun run validate:roadmap
bun run validate:agent-contract
bun run validate:architecture-docs
bun run validate:audit
bun run validate:mac-private-release-boundary
bun run validate:windows-private-release-boundary
bun run validate:private-release-pipeline
bun run validate:bundle-policy
bun run lint:i18n:parity
bun run typecheck:all
bun test
bun run electron:build
git diff --check
```

Stop at the first non-zero. High-risk regressions (audit §5: storage,
RBAC, audit, Mac/Windows trust) trigger §8 failure recovery; everything
else fixes inline and re-runs from `validate:rebrand`.

## 8. Failure recovery — abort the merge

```bash
git merge --abort                                    # if mid-merge
git switch main && git reset --hard pre-m3-upstream-v0.9.3
git log --oneline | head -3
git diff pre-m3-upstream-v0.9.3..HEAD                # expected: empty
git branch -D chore/upstream-v0.9.3-rox-merge
git push origin --delete chore/upstream-v0.9.3-rox-merge  # if pushed
```

After abort: open a blocker ticket in the M.3 cluster, document the
failing gate + conflict pattern in §10 of the blocker, and re-attempt
only after the blocker closes on `main`. Keep `pre-m3-upstream-v0.9.3`
on origin as rollback escrow.

## 9. Ticket cluster

Audit §10 documents the re-numbering constraint (T230/T232 were
repurposed). At merge time pick three contiguous FREE slots from spine
range `T306-T320` (or T231 if still free):

- `T<n>-upstream-v0.9.3-merge-plan` — Steps 1–4 evidence.
- `T<n+1>-upstream-v0.9.3-merge-implementation` — Steps 5–7 evidence +
  merge commit SHA.
- `T<n+2>-upstream-v0.9.3-merge-evidence-log` — every conflict choice
  with its audit §8 pattern.

## 10. Closeout

```bash
git push -u origin chore/upstream-v0.9.3-rox-merge
gh pr create --base main --head chore/upstream-v0.9.3-rox-merge \
  --title "M.3 — Upstream v0.9.3 merge (ROX-protected)" \
  --body-file .omc/state/m3-pr-body.md

# After merge:
echo "M.3-upstream-v0.9.3-merge | <sha> | T<n>,T<n+1>,T<n+2> | $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >> .swarm/master-roadmap-log.md
```

Bump `package.json` `version` to track upstream by hand; runbook does not
automate it because R.10/R.11 may also change the package name.

Gate: `.swarm/master-roadmap-log.md` carries the new line and
`bun run validate:roadmap` exits 0.

## 11. Stopping condition

M.3 is `DONE` when: the merge PR is merged to `main`; audit §7 validation
matrix is fully green on the merged tree; the three M.3 tickets are
`Status: DONE` with worklogs + commit SHAs; `.swarm/master-roadmap-log.md`
carries the M.3 closeout line; `pre-m3-upstream-v0.9.3` tag is preserved
on origin (rollback escrow); next spine phase M.4 (account persistent
session storage) is unblocked.
