# T296 - Rebrand sweep closeout (R.10)

Status: DONE

## Context

We are building a white-label fork of Rox Agents OSS into
ROX.ONE Agent Workbench Suite.

Phase R.10 of the ROX.ONE rebrand sweep
(`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`,
"Phase R.10 — Final sweep + closeout"). Prior phases:

- R.0 — Canonical inventory (T260, T261, T262)
- R.1 — Surface-text completion (T263)
- R.2 — Code identifier renames (T264, T265, T266)
- R.3 — Asset file renames (T267, T268)
- R.4 — Doc/plan cleanup (T269, T270, T271, T272)
- R.5 — Package scope renames (T273–T284)
- R.6 — Env-var shim (T285, T286, T287, T288)
- R.7 — Docker / CI / build (T289, T290, T291)
- R.8 — User-data migration (T292, T293, T294)
- R.9 — Community-link audit (T295)
- R.9.5 — Allowlist expansion + final literal-text scrub (T298a, T300a)

R.10 is the closeout. After R.9.5 landed at `b6ce2c4`,
`bun run validate:rebrand` exits 0 ("rebrand validation passed: no
forbidden tokens outside the allowlist"). T296 records the closeout
evidence (per-phase commit-SHA + ticket-ID summary) and tags the
sweep `rebrand-v1`. T297 (sibling ticket in the same commit set)
installs the permanent enforcement gate.

This ticket is the R.10 closeout — its commit set appends the R.10
ledger line to `.swarm/master-roadmap-log.md`.

Relevant product goals:

- local desktop app
- managed web/cloud app
- user/team workspaces
- prompt modes
- multi-agent workflows
- validation gates
- TDD-first implementation

## Goal

1. Record the closeout summary in `docs/worklog/T296-rebrand-sweep-closeout.md`
   listing every prior R-phase, its merge commit SHA, and its ticket
   set. Source of truth: `.swarm/master-roadmap-log.md` plus the
   merge commits on `main` from `git log`.
2. Tag the closeout commit `rebrand-v1` so future merges can fast-forward
   past it cleanly. The tag points at the local branch SHA at sweep
   close; the operator may re-point the tag at the merge SHA after the
   PR squash-merges, OR retain the pre-merge tag and create a
   `rebrand-v1` (canonical) tag at merge time. Choose-and-document is
   captured in the worklog Remaining-risks section.
3. Append the R.10 ledger line to `.swarm/master-roadmap-log.md`.
4. Confirm `plan.md` §1 already reads in the canonical voice
   ("ROX.ONE Agent Workbench Suite") — R.9.5 already verified this;
   the closeout worklog records the verification.
5. Confirm LICENSE / NOTICE / TRADEMARK.md / Dockerfile.server
   `image.source` label are untouched (Apache 2.0 §4 attribution).

## Required UI

None. Documentation + tag + ledger only.

## Required Data/API

None.

## Required Automations

None new. T297 installs the permanent gate (pre-push hook + CI step).

## Required Subagents

None — direct documentation work with deterministic provenance pulled
from `.swarm/master-roadmap-log.md` and `git log`.

## TDD Requirements

The "test" for T296 IS `bun run validate:rebrand` exiting 0 on the
closeout commit. The new regression test that fails closed if the gate
itself is removed lives under T297
(`scripts/__tests__/rebrand-permanent-gate.test.ts`). Concretely:

1. From the R.10 worktree, run `bun run validate:rebrand` and verify
   exit code 0 with the message
   "rebrand validation passed: no forbidden tokens outside the allowlist".
2. Sibling rebrand regression tests continue to pass:
   - `bun test scripts/__tests__/rebrand-surface-text.test.ts`
   - `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
   - `bun test scripts/__tests__/community-link-audit.test.ts`

## Implementation Requirements

- `docs/worklog/T296-rebrand-sweep-closeout.md` summarises R.0–R.9.5
  with per-phase ticket IDs, merge commit SHAs sourced from
  `.swarm/master-roadmap-log.md`, and a one-line outcome description.
- `.swarm/master-roadmap-log.md` gains the R.10 ledger line:
  `rebrand-R.10-final-sweep-and-gate | <SHA> | T296,T297 | <ISO-8601>`.
- The closeout commit is tagged `rebrand-v1` and the tag is pushed
  to `origin`. Re-pointing-at-merge-SHA policy documented in the
  worklog Remaining-risks section.
- No code edits beyond the master-roadmap-log line. The pre-push
  hook + CI workflow edit + regression test live in T297.

## Validation Commands

- `bun run validate:rebrand` (MUST exit 0 — this is the closeout proof).
- `bun test scripts/__tests__/rebrand-permanent-gate.test.ts` (T297's
  new regression test — green after T297 lands).
- `bun test scripts/__tests__/rebrand-surface-text.test.ts`
- `bun test scripts/__tests__/rebrand-doc-cleanup.test.ts`
- `bun test scripts/__tests__/community-link-audit.test.ts`
- `git diff --check`

`bun run typecheck` and `bun run lint` are infrastructure-only on the
worktree (require `bun install` in worktree). The CI workflow runs
them on real CI; the R.10 closeout does not change any source file
those checks scan, so they are not gating-blockers for the closeout
commit.

## Acceptance Criteria

- [x] `bun run validate:rebrand` exits 0 on the closeout commit.
- [x] `docs/worklog/T296-rebrand-sweep-closeout.md` carries the R.0–R.9.5
      summary table with commit SHAs from `.swarm/master-roadmap-log.md`.
- [x] `.swarm/master-roadmap-log.md` carries the R.10 ledger line.
- [x] `rebrand-v1` tag is created and pushed.
- [x] LICENSE / NOTICE / TRADEMARK.md / Dockerfile.server attribution
      label untouched (verified by `git diff main -- LICENSE NOTICE TRADEMARK.md Dockerfile.server`).
- [x] `plan.md` §1 reads canonical voice (verified).
- [x] T297 sibling ticket lands the permanent gate (separate commit).

## Worklog

Update `docs/worklog/T296-rebrand-sweep-closeout.md`.
