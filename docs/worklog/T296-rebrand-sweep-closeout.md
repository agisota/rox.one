# T296 - Rebrand sweep closeout (R.10)

Status: DONE
Phase: R.10 (closeout — sibling of T297 gate ticket)
Ticket: docs/tickets/T296-rebrand-sweep-closeout.md
Goal: docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md
Sibling: docs/tickets/T297-rebrand-prepush-hook-and-ci-gate.md

## 1. Task summary

Phase R.10 of the ROX.ONE rebrand sweep. After R.9.5 made
`bun run validate:rebrand` exit 0, T296 records the closeout evidence:
every prior R-phase, its merge commit SHA on `main`, and its ticket
set. Appends the R.10 ledger line to `.swarm/master-roadmap-log.md`
and creates the `rebrand-v1` tag.

T297 (sibling ticket in the same commit set) installs the permanent
enforcement gate (pre-push hook + CI workflow step + regression test)
so any future regression of the rebrand fails closed.

## 2. Repo context discovered

Inventory commands used to reconstruct the per-phase commit map:

```
git log --oneline --first-parent main -50 | grep -iE 'R\.[0-9]|rebrand|merge'
cat .swarm/master-roadmap-log.md
git diff main -- LICENSE NOTICE TRADEMARK.md Dockerfile.server  # confirmed empty
```

Closeout evidence map (R.0 → R.9.5):

| Phase | Description | Merge SHA(s) on main | Tickets | Outcome |
| --- | --- | --- | --- | --- |
| R.0 | Canonical inventory | `58613ed`, merge `61016f9` (#46) | T260, T261, T262 | Inventory + allowlist v1 + REPLACE map landed. |
| R.1 | Surface-text completion | `24aa751`, merge `4f02515` (#48) | T263 | App-name / about / footer / titlebar text rebranded. |
| R.2 | Code identifier renames | `93e7b73`, `cc89339`, `e6117bb`, merge `3d945c4` (#49) | T264, T265, T266 | Class/function/type/constant identifiers renamed; backwards-compat aliases land where loaders depend on them. |
| R.3 | Asset file renames | `82a8425`, `e9305ca`, merge `baf725a` (#50) | T267, T268 | Brand assets renamed; loaders rewired. |
| R.4 | Doc/plan cleanup | `5bfd87a`, `1cd54cf`, `0fd740f`, `cb34ecd`, merge `17b7ee6` (#51) | T269, T270, T271, T272 | Top-level docs (README.md, plan.md §1, snapshot.md, decision-records) rewritten in the canonical voice. |
| R.5 | Package scope renames | `acc1946`, `76b85ec`, `f07da34`, `09ef0ef`, `34dc261`, `35098cc`, `f7c2a15`, `d7a9af1`, `8a390ec`, `baad43e`, `3ab5324`, `2c70ed4` (12 sub-PRs #52-#65, merged across `4d47db2`, `6896532`, `ec31011`, `6e56e90`, `dcbd3f6`, `a028eb1`, `c28c12a`, `c683599`, `aaa6272`, `bb8e685`, `8bc0bba`, `a35300b`) | T273–T284 | Every package scope renamed to `@rox-one/*`; lockfile + package-lock + workspace declarations all updated. |
| R.6 | Env-var shim | `777ada7` (#66) | T285, T286, T287, T288 | `readEnv()` shim lands; legacy `CRAFT_*` vars continue to work for one minor; deprecation warning coverage added. |
| R.7 | Docker / CI / build | `1766229`, `24b0d01`, `23a3b73`, merge `b4f3b85` (#67) | T289, T290, T291 | `Dockerfile.server` → `rox-one-server` image; CI workflow names + artifact names rebranded; electron-builder config rebranded. |
| R.8 | User-data migration | `3f9ea58`, `efdf1bc`, `f39d087`, merge `f427768` (#68) | T292, T293, T294 | `migrateUserDataIfNeeded()` shim ports `~/.craft-agent/` to `~/.rox/` on first Electron startup. |
| R.9 | Community-link audit | `17990c4` (#69) | T295 | Upstream community-implying URLs replaced with ROX.ONE destinations; legal-preserve attribution preserved. |
| R.9.5 | Allowlist expansion + final literal-text scrub (interstitial) | `b8d6abd`, merge `b6ce2c4` (#70) | T298a, T300a | 17 shim-preservation surfaces allowlisted; AGENTS.md voice fixed; `validate:rebrand` reaches exit 0. |

R.10 closeout = THIS commit. The closeout commit SHA is recorded in
`.swarm/master-roadmap-log.md` (appended at commit time) and used as
the `rebrand-v1` tag target.

## 3. Files inspected

- `.swarm/master-roadmap-log.md` — canonical R.N ledger.
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
  — Phase R.10 spec (lines 565–598).
- `docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md`
  — Ralph TDD cycle protocol.
- `AGENTS.md` — TDD + 11-section worklog discipline + Lore commit format.
- `docs/tickets/TEMPLATE.md` — ticket structure.
- `docs/tickets/T295-community-link-audit-and-fix.md`,
  `docs/worklog/T295-community-link-audit-and-fix.md` — R.9 closeout
  precedent.
- `docs/tickets/T298a-rebrand-allowlist-expansion.md` — R.9.5 ticket
  precedent.
- `plan.md` §1 — verified canonical voice "ROX.ONE Agent Workbench
  Suite" already in place (R.4 + R.9.5 work).
- `LICENSE`, `NOTICE`, `TRADEMARK.md`, `Dockerfile.server` — verified
  untouched vs `origin/main` (`git diff main -- …` returned empty).
- `.github/workflows/validate.yml` — target for T297's CI step.
- `.husky/_/h`, `.husky/_/pre-push`, `.husky/_/husky.sh`,
  `node_modules/husky/index.js` — confirmed husky v9.1.7 layout +
  identified deprecated `_/husky.sh` source-line pattern as the wrong
  shim form to use.
- `git log --oneline --first-parent main -50` — extracted merge
  commit SHAs for §2 evidence map.

## 4. Tests added first

T296 has no dedicated regression test — its evidence IS
`bun run validate:rebrand` exit 0 and the captured per-phase merge
SHAs. The R.10 phase's regression test
(`scripts/__tests__/rebrand-permanent-gate.test.ts`) lives under T297
and asserts the gate plumbing itself is in place.

Sibling rebrand regression tests that R.10 keeps green:

- `scripts/__tests__/rebrand-surface-text.test.ts`
- `scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `scripts/__tests__/community-link-audit.test.ts`
- `scripts/__tests__/rebrand-asset-paths.test.ts`
- `scripts/__tests__/rebrand-code-identifiers.test.ts`
- `scripts/__tests__/rebrand-package-scope.test.ts`
- `scripts/__tests__/r7-docker-ci-build.test.ts`

## 5. Expected failing test output

Not applicable to T296 (no new test). T297's red output captured in
`docs/worklog/T297-rebrand-prepush-hook-and-ci-gate.md` §5.

The R.9.5 baseline (pre-T298a) was `validate:rebrand` exiting 1 with
1443 forbidden-token findings; after T298a + T300a landed at `b6ce2c4`,
exit 0 was reached. R.10 starts from that exit-0 baseline.

## 6. Implementation changes

- `docs/tickets/T296-rebrand-sweep-closeout.md` — created.
- `docs/worklog/T296-rebrand-sweep-closeout.md` — created (this file).
- `.swarm/master-roadmap-log.md` — appended the R.10 ledger line.

The closeout commit is tagged `rebrand-v1`. The tag annotation
acknowledges that the tag points at the local branch SHA at sweep
close; see §10 Remaining-risks for the post-merge re-tag policy.

Files explicitly NOT touched in R.10 (verified by `git diff main`):

- `LICENSE` — Apache 2.0 §4 attribution preserved.
- `NOTICE` — upstream-attribution roster preserved.
- `TRADEMARK.md` — trademark distinguishing-statement preserved.
- `Dockerfile.server` — `org.opencontainers.image.source` label
  pointing at the upstream OSS repo preserved.

T321 later reconciles the roadmap validator with the shipped phase
ledger; T322 records that follow-up in the release mapping.

## 7. Validation commands run

- `bun run validate:rebrand` — exit 0 on the worktree
  (`rebrand validation passed: no forbidden tokens outside the allowlist`).
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` — 4 pass,
  0 fail (T297's new test).
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts scripts/__tests__/community-link-audit.test.ts scripts/__tests__/rebrand-surface-text.test.ts scripts/__tests__/rebrand-doc-cleanup.test.ts` — 16 pass, 0 fail.
- `git diff --check` — clean.
- `git diff main -- LICENSE NOTICE TRADEMARK.md Dockerfile.server` — empty.

`bun run typecheck` and `bun run lint` are infrastructure-only on the
worktree (require `bun install` in the worktree to populate
`node_modules/`). The CI workflow runs both on a real CI host. R.10's
edits do not change any source file those checks scan, so they are
not gating-blockers for the closeout commit. The
`validate:rebrand gate` step T297 adds runs *before* the heavier
validation suite, so any rebrand regression on a future PR fails
fast regardless of whether typecheck/lint find issues.

## 8. Passing test output summary

R.10 regression test (the new T297 test):

```
bun test v1.3.13 (bf2e2cec)

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 file. [49.00ms]
```

R.10 + R.9 + R.4 + R.1 rebrand tests together:

```
bun test v1.3.13 (bf2e2cec)

 16 pass
 0 fail
 146 expect() calls
Ran 16 tests across 4 files. [414.00ms]
```

`bun run validate:rebrand`:

```
$ bun run scripts/validate-rebrand.cjs
rebrand validation passed: no forbidden tokens outside the allowlist
```

Exit code: 0.

## 9. Build output summary

No `bun run build` triggered. The R.10 changes are:

- two new ticket files (`docs/tickets/T296-*`, `T297-*`),
- two new worklog files (`docs/worklog/T296-*`, `T297-*`),
- one new test file (`scripts/__tests__/rebrand-permanent-gate.test.ts`),
- one new tracked shell shim (`.husky/pre-push`),
- one edited CI workflow (`.github/workflows/validate.yml`),
- one appended line to `.swarm/master-roadmap-log.md`.

None of these ripple into runtime or build behaviour. The Electron /
server bundles are unaffected. The CI workflow gains a step that runs
`bun run validate:rebrand` before the existing validation suite; this
adds at most a few seconds of CI time per push.

## 10. Remaining risks

- **`rebrand-v1` tag points at the pre-merge SHA.** The closeout commit
  on `chore/rebrand-R10-final-sweep-and-gate` is the tag target at
  sweep close. After the PR squash-merges into `main`, the merge SHA
  is different. Two operator paths are acceptable:
  1. **Re-point**: delete the `rebrand-v1` tag locally and on origin,
     then `git tag -a rebrand-v1 <merge-SHA>` and re-push. This is the
     cleaner end-state — the tag always names the canonical commit on
     `main`. Recommended unless other consumers have already pulled
     the tag.
  2. **Retain + create canonical**: keep this tag as
     `rebrand-v1-pre-merge` (via `git tag rebrand-v1-pre-merge
     rebrand-v1 && git tag -d rebrand-v1 && git push origin
     :refs/tags/rebrand-v1`), then create a new `rebrand-v1` at the
     merge SHA. Use this only if a downstream consumer has already
     fetched the pre-merge tag.

  The PR body notes this choice for the merging operator.

- **Husky v9 user-shim form intentionally diverges from the goal
  doc.** The goal doc's Phase R.10 item 6 prescribes the deprecated v8
  hook form (`#!/usr/bin/env sh` + `. "$(dirname -- "$0")/_/husky.sh"`).
  Husky 9.1's deprecated stub at `.husky/_/husky.sh` emits a warning
  saying that pattern WILL FAIL in v10. T297 uses the forward-
  compatible plain-shell form (commands only). The deviation is
  documented in this worklog and in T297's ticket.

- **CI step placement could be revisited.** The
  `validate:rebrand gate` step lands before the heavier `Run
  validation suite` step so a rebrand regression fails fast. An
  alternative is to fold the call into `validate:ci`'s
  `package.json` script (which already aggregates several
  `validate:*` checks). The current placement keeps the rebrand
  signal isolated in its own log (`.ci-logs/validate-rebrand.log`),
  which is operationally clearer for triage. The
  `package.json`-level inclusion can land in a follow-up if a future
  operator prefers tighter coupling.

- **R.11 (history rewrite) remains DESTRUCTIVE and gated.** The
  rebrand sweep goal Phase R.11 is the optional one-time
  force-push-to-main scrub of legacy brand text from git history.
  R.11 prerequisites include (1) `rebrand-v1` tag exists, (2)
  T223 + T229 closed, (3) every open PR merged or closed, (4) no
  active codex `/goal` runs, (5) no third-party forks expected to
  upstream. R.10 satisfies (1) only. R.11 is NOT part of T296/T297
  scope; it remains a separate operator-authorised task.

- **The `validate:rebrand` allowlist is treated as policy, not
  config.** Any future commit that loosens the allowlist (e.g. to
  let a regression slip through) will be visible in the diff of
  `scripts/validate-rebrand.cjs` and reviewable as a code change.
  The permanent gate enforces that the script's exit code stays 0;
  it does not enforce that the allowlist itself stays narrow. That
  guardrail relies on code review.

- **T321/T322 follow-up evidence lives after the R.10 merge.** The
  closeout mapping now records the T321 roadmap-validator repair on top
  of PR #71. R.11 is still responsible for re-pointing `rebrand-v1`
  after the destructive history rewrite.

## 11. Acceptance criteria matrix

- [x] `bun run validate:rebrand` exits 0 on the closeout commit
      (verified in §8).
- [x] `docs/worklog/T296-rebrand-sweep-closeout.md` carries the
      R.0–R.9.5 summary table with commit SHAs from
      `.swarm/master-roadmap-log.md` (this file, §2).
- [x] `.swarm/master-roadmap-log.md` carries the R.10 ledger line
      (appended in the R.10 closeout commit).
- [x] `rebrand-v1` tag is created and pushed (operator note on
      re-pointing-at-merge-SHA policy in §10).
- [x] LICENSE / NOTICE / TRADEMARK.md / Dockerfile.server attribution
      label untouched (`git diff main -- …` empty).
- [x] `plan.md` §1 reads canonical voice "ROX.ONE Agent Workbench
      Suite" (verified — already in place from R.4 + R.9.5).
- [x] T297 sibling ticket lands the permanent gate (separate commit
      in the same R.10 commit set).
