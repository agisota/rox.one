# T295 - Community-link audit and fix

Status: DONE

## Context

Phase R.9 of the ROX.ONE rebrand sweep
(`docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`,
"Phase R.9 — Community-link audit"). After R.0–R.8 landed every code,
docs, package-scope, env-var, Docker, and user-data migration concern,
R.9 is the final pass that removes upstream-community-implying URLs
(Discord, Twitter/X, forum, upstream GitHub repo/issues) from
user-facing surfaces — *while preserving* every URL that exists to
satisfy Apache 2.0 §4 attribution or to record historical state.

This ticket is the R.9 closeout — its commit set appends the R.9
ledger line to `.swarm/master-roadmap-log.md`.

## Goal

1. Land a TDD regression test at
   `scripts/__tests__/community-link-audit.test.ts` that scans every
   tracked file for community-implying URL patterns and fails closed if
   any appears outside the legal-preserve allowlist.
2. Replace every community-implying URL the audit detects with the
   ROX.ONE-equivalent destination (or with the ROX.ONE-owned GitHub repo
   path where the link is operational rather than community-facing).
3. Document the PRESERVE set in
   `docs/release/rebrand-mapping-2026-05-13.md` under a new "Legal
   preserve — community links" section, naming each preserved path and
   the justification.

## Required UI

None.

## Required Data/API

None.

## Required Automations

None.

## Required Subagents

None.

## TDD Requirements

`scripts/__tests__/community-link-audit.test.ts` asserts:

1. Zero forbidden community-implying URL hits outside the allowlist
   (the primary regression guarantee).
2. The pattern set does not match the approved ROX.ONE destinations
   (`https://discord.gg/rox-one`, `https://x.com/rox_one`,
   `https://twitter.com/rox_one`) — proves the gate distinguishes
   approved vs. forbidden.
3. The pattern set *does* match a curated list of bad-example lines
   (self-test for regex coverage).

Forbidden patterns the test searches for:

- `https://github.com/lukilabs/craft-agents-oss` as a standalone reference
  outside the legal-preserve allowlist (i.e. anywhere other than LICENSE,
  NOTICE, TRADEMARK.md, Dockerfile.server, README's Acknowledgements,
  historical release notes, historical worklogs/tickets, ADRs, plan.md,
  snapshot.md, and the goal/spec files that name the rule).
- `https://github.com/lukilabs/craft-agents-oss/pulls` (demo browser tabs).
- `https://github.com/lukilabs/craft-agents-oss/issues/<n>` outside
  historical-record files. A line-level allowlist suppresses one
  developer-facing JSDoc bug-trace
  (`packages/server-core/src/sessions/SessionManager.ts:680`) that cites
  the upstream issue tracker for traceability of why the SDK subprocess
  disables Bun's auto `.env` loading.
- `https://discord.gg/<not-rox-one>` invites.
- `https://twitter.com/<not-rox_one>` and `https://x.com/<not-rox_one>`
  handles.
- Generic `craft community` / `craft forum` / `craft discord` prose.

The test must fail before the replacements land and pass after.

## Implementation Requirements

- Two source files carry REPLACE hits:
  - `.github/ISSUE_TEMPLATE/bug_report.yml` — the Troubleshooting README
    link is rewritten from `lukilabs/craft-agents-oss` to
    `agisota/rox-one-terminal`.
  - `apps/electron/src/renderer/playground/registry/browser-ui.tsx` —
    two playground demo URLs are rewritten from the upstream repo to
    the ROX.ONE-owned repo.
- `docs/release/rebrand-mapping-2026-05-13.md` gains a "Legal preserve —
  community links" section listing the PRESERVE set with per-row
  justification, plus the explicit REPLACE table for the R.9 commit.
- The audit test file is whole-file-allowlisted inside itself (it
  mentions the forbidden patterns by definition).
- No placeholder URLs are used (every replacement points at a live
  ROX.ONE-owned GitHub destination); the placeholder pathway documented
  in the goal (`discord.gg/rox-one`, `x.com/rox_one`, `rox.one/community`)
  is reserved for future tickets where a canonical Discord / X / docs
  site URL needs to land in user-facing prose.
- Manual click-through on every replaced URL is recorded as
  `TBD: manual verification` per the goal's R.9 allowance.

## Validation Commands

- `bun test scripts/__tests__/community-link-audit.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand` (may have unrelated findings — Phase R.10
  closes them)
- `bun run validate:roadmap` (may exit 1 with known stale rows — Phase
  R.10 fixes them)
- `git diff --check`

## Acceptance Criteria

- [x] `scripts/__tests__/community-link-audit.test.ts` exists and
      fails before the REPLACE edits land.
- [x] After the REPLACE edits, the test is green (3 pass, 0 fail).
- [x] `docs/release/rebrand-mapping-2026-05-13.md` carries the
      "Legal preserve — community links" section with the REPLACE
      table and the PRESERVE table.
- [x] `bun run typecheck` and `bun run lint` are green.
- [x] `.swarm/master-roadmap-log.md` carries the R.9 ledger line.

## Worklog

Update `docs/worklog/T295-community-link-audit-and-fix.md`.
