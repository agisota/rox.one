# T295 - Community-link audit and fix

Status: DONE
Phase: R.9 (closeout)
Ticket: docs/tickets/T295-community-link-audit-and-fix.md
Goal: docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md

## 1. Task summary

Phase R.9 of the ROX.ONE rebrand sweep. Audit every tracked file for
community-implying URLs (Discord, Twitter/X, forum, upstream GitHub
repo/issues, generic "rox community" prose). Replace each hit that
points users back at the upstream Rox Agents community with the
ROX.ONE-equivalent destination. Preserve every URL that exists to
satisfy Apache 2.0 §4 attribution or to record historical state.

Land a TDD regression test that fails closed if any of the forbidden
patterns reappear outside the legal-preserve allowlist; document the
PRESERVE set + REPLACE set in
`docs/release/rebrand-mapping-2026-05-13.md`; append the R.9 ledger
line to `.swarm/master-roadmap-log.md`.

## 2. Repo context discovered

Inventory command (from the goal):

```
rg -in 'discord|twitter\.com|x\.com|community\.|forum\.|docs\..*rox' \
  --type md --type ts --type json --type yaml --type html
```

Note: ripgrep's built-in `ts` type already covers `.tsx`; there is no
built-in `cjs`/`mjs` type alias, but the audit test reads tracked files
via `git ls-files` and therefore covers every file regardless of
extension.

Raw inventory produced 16 hits across these buckets:

- **Generic-third-party Discord webhook documentation** (PRESERVE, not
  community-implying):
  - `apps/electron/resources/docs/automations.md` — Discord prose and
    `ROX_WH_DISCORD_URL` example showing how arbitrary Discord
    webhooks integrate.
  - `packages/shared/src/automations/utils.ts:295` — `ROX_WH_DISCORD_TOKEN`
    JSDoc example.
- **Historical immutable artifacts** (PRESERVE):
  - `apps/electron/resources/release-notes/0.9.0.md:46` — historical
    `docs.rox.do/messaging/lark` link in a shipped release note.
  - Many `lukilabs/rox-agents-oss/issues/<n>` references throughout
    `apps/electron/resources/release-notes/*.md`.
  - `docs/worklog/T*-*.md` (DONE) — historical record of merge / setup work
    that named the upstream remote.
- **Legal-preserve attribution** (PRESERVE):
  - `LICENSE`, `NOTICE`, `TRADEMARK.md`, `Dockerfile.server` `image.source`
    label, `README.md` Acknowledgements section, `plan.md`, `snapshot.md`,
    `docs/release/upstream-v0.9.1-rox-protected-map.md`,
    `docs/decision-records/*`, `scripts/validate-rebrand.cjs`,
    `scripts/__tests__/r7-docker-ci-build.test.ts`.
- **Rule-defining goal files** (PRESERVE — they name the forbidden
  patterns by definition):
  - `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`,
    `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`,
    `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`.
- **Developer-facing traceability comment** (line-allowlisted):
  - `packages/server-core/src/sessions/SessionManager.ts:680` —
    `See: https://github.com/lukilabs/rox-agents-oss/issues/39` is a
    JSDoc bug-trace explaining *why* the SDK subprocess disables Bun's
    auto `.env` loading. It is developer-facing internal documentation,
    not a user-directed community link. Suppressed via a narrow line
    allowlist in the audit test.
- **Community-implying URLs to REPLACE** (3 hits, 2 paths):
  - `.github/ISSUE_TEMPLATE/bug_report.yml:116` — user-facing bug-report
    template directed reporters at the upstream README.
  - `apps/electron/src/renderer/playground/registry/browser-ui.tsx:691`
    and `:783` — playground demo seed data rendered mock browser tabs
    pointing at the upstream OSS repo.

The bug-report template hit was not flagged by the goal-text inventory
regex (which uses `discord|twitter\.com|x\.com|community\.|forum\.|docs\..*rox`)
because the URL is a GitHub upstream-repo link without `discord/twitter/x/community/forum`
in the path. The audit test treats `https://github.com/lukilabs/rox-agents-oss`
as a forbidden pattern in its own right (community-implying outside the
attribution-allowlist), and therefore caught it correctly.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` (Phase R.9 + legal-preserve allowlist).
- `docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md` (cycle protocol).
- `AGENTS.md` (TDD + 11-section worklog discipline).
- `docs/release/rebrand-mapping-2026-05-13.md` (existing Bucket: Community Links).
- `scripts/validate-rebrand.cjs` (legal-preserve allowlist patterns).
- `scripts/__tests__/rebrand-surface-text.test.ts`,
  `scripts/__tests__/rebrand-asset-paths.test.ts`,
  `scripts/__tests__/rebrand-doc-cleanup.test.ts` (test-shape references).
- `.github/ISSUE_TEMPLATE/bug_report.yml` (replaced one line).
- `apps/electron/src/renderer/playground/registry/browser-ui.tsx` (replaced two demo URLs).
- `packages/server-core/src/sessions/SessionManager.ts` (line-allowlisted JSDoc bug-trace).
- `apps/electron/resources/docs/automations.md` (verified PRESERVE — generic third-party docs).
- `packages/shared/src/automations/utils.ts` (verified PRESERVE — generic third-party docs).
- `docs/worklog/T294-user-data-migration-electron-startup-wire.md` (worklog template).
- `.swarm/master-roadmap-log.md` (R.0–R.8 ledger format reference).

## 4. Tests added first

`scripts/__tests__/community-link-audit.test.ts` (new). Three test cases:

1. **Zero forbidden community-implying URLs outside the legal-preserve
   allowlist.** Reads every tracked file via `git ls-files -z`, applies
   the whole-file + prefix allowlist, then matches each remaining line
   against the regex set. Fails closed with a sorted printable list of
   every offending `path:line [pattern-id] <line>` row.
2. **Approved ROX.ONE destinations are recognised** (`discord.gg/rox-one`,
   `x.com/rox_one`, `twitter.com/rox_one` are never matched).
3. **Forbidden destinations are detected by the regex set** (self-test).
   Curated bad-example lines each match the expected pattern id.

Regex set:

| id | regex | description |
| --- | --- | --- |
| `upstream-issues-link` | `https://github.com/lukilabs/rox-agents-oss/issues/\d+` | upstream issue refs outside historical records (line-allowlist for `SessionManager.ts:680`). |
| `upstream-repo-tab` | `https://github.com/lukilabs/rox-agents-oss(?!\.git\|/issues\|/pulls)\b` | standalone upstream-repo references outside attribution. |
| `upstream-pulls-tab` | `https://github.com/lukilabs/rox-agents-oss/pulls\b` | demo browser tabs / similar. |
| `non-rox-discord-invite` | `https?://discord\.gg/(?!rox-one\b)[A-Za-z0-9_-]+` | non-canonical Discord invites. |
| `non-rox-twitter-handle` | `https?://twitter\.com/(?!rox_one\b)[A-Za-z0-9_]+` | non-canonical Twitter handles. |
| `non-rox-x-handle` | `https?://(?:www\.)?x\.com/(?!rox_one\b)[A-Za-z0-9_]+` | non-canonical X handles. |
| `rox-community-text` | `\b(?:Cr\|cr)aft (community\|forum\|discord)\b` (case-insensitive) | literal rox-community prose. |

Allowlist set in the test:

- Whole-file: `LICENSE`, `NOTICE`, `TRADEMARK.md`, `Dockerfile.server`,
  `plan.md`, `snapshot.md`, `README.md`, `scripts/validate-rebrand.cjs`,
  `scripts/__tests__/community-link-audit.test.ts`,
  `scripts/__tests__/r7-docker-ci-build.test.ts`,
  `scripts/__tests__/rebrand-doc-cleanup.test.ts`, the two R.9-defining
  goal docs, the master-roadmap goal doc, the rebrand-mapping report,
  and the upstream-merge protected map.
- Prefix: `apps/electron/resources/release-notes/`, `docs/worklog/T`,
  `docs/tickets/T`, `docs/decision-records/`, `.brv/`, `.swarm/`,
  `.git/`, `node_modules/`, `dist/`, `.tmp-tsc/`.
- Line: the `SessionManager.ts:680` JSDoc bug-trace.

## 5. Expected failing test output

Run on the pre-fix HEAD (after the test file landed, before the three
REPLACE edits):

```
expect(received).toEqual(expected)

- []
+ [
+   ".github/ISSUE_TEMPLATE/bug_report.yml:116 [upstream-repo-tab] Launch the app with `-- --debug` and reproduce the issue. See the [Troubleshooting section in the README](https://github.com/lukilabs/rox-agents-oss#troubleshooting) for platform-specific commands and log file locations.",
+   "apps/electron/src/renderer/playground/registry/browser-ui.tsx:691 [upstream-pulls-tab] url: 'https://github.com/lukilabs/rox-agents-oss/pulls',",
+   "apps/electron/src/renderer/playground/registry/browser-ui.tsx:783 [upstream-repo-tab] url: 'https://github.com/lukilabs/rox-agents-oss',",
+ ]

(fail) R.9 community-link audit > zero forbidden community-implying URLs outside the legal-preserve allowlist
 2 pass
 1 fail
 27 expect() calls
```

Exactly the three REPLACE hits classified in Section 2.

## 6. Implementation changes

| Path:line | Old URL | New URL |
| --- | --- | --- |
| `.github/ISSUE_TEMPLATE/bug_report.yml:116` | `https://github.com/lukilabs/rox-agents-oss#troubleshooting` | `https://github.com/agisota/rox-one-terminal#troubleshooting` |
| `apps/electron/src/renderer/playground/registry/browser-ui.tsx:691` | `https://github.com/lukilabs/rox-agents-oss/pulls` | `https://github.com/agisota/rox-one-terminal/pulls` |
| `apps/electron/src/renderer/playground/registry/browser-ui.tsx:783` | `https://github.com/lukilabs/rox-agents-oss` | `https://github.com/agisota/rox-one-terminal` |

No placeholder URLs (`discord.gg/rox-one`, `x.com/rox_one`,
`rox.one/community`) were needed — every REPLACE redirects to the
ROX.ONE-owned GitHub repo, which exists today.

`docs/release/rebrand-mapping-2026-05-13.md`: added the "Legal preserve
— community links (R.9 closeout)" section with the REPLACE table, the
PRESERVE table (with per-row justification), the placeholder-policy
note, and the verification summary.

`.swarm/master-roadmap-log.md`: appended the R.9 ledger line.

## 7. Validation commands run

- `bun test scripts/__tests__/community-link-audit.test.ts`
- `bun test scripts/__tests__/rebrand-surface-text.test.ts scripts/__tests__/rebrand-doc-cleanup.test.ts scripts/__tests__/community-link-audit.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

Audit-only run:

```
bun test v1.3.13 (bf2e2cec)
 3 pass
 0 fail
 27 expect() calls
Ran 3 tests across 1 file. [422.00ms]
```

Audit + sibling rebrand tests (12 tests across 3 files):

```
bun test v1.3.13 (bf2e2cec)
 12 pass
 0 fail
 142 expect() calls
Ran 12 tests across 3 files. [433.00ms]
```

`bun run typecheck` — clean (no diagnostic output).

`bun run lint` — clean (lint:ipc-sends, lint:electron, lint:shared,
lint:ui all pass).

`bun run validate:rebrand` exits 1 with 1435 forbidden-token findings
(R.0 → R.10 progression — was 1438 pre-R.9, three fewer after the
upstream-URL removals). These are unrelated to R.9 scope; Phase R.10
is the final-sweep ticket that drives this back to zero.

`bun run validate:roadmap` exits 1 with the same stale ledger rows
that were known pre-R.9 (M.11–M.21 + P.1–P.6 phase headings missing
from the spine doc, plus T223/T229 listed in two files). Tracked
separately from R.9.

`git diff --check` — clean.

## 9. Build output summary

No `bun run build` triggered. The change is documentation, a new test
file, three URL-string replacements in playground demo seed data and
one URL-string replacement in a GitHub issue template — none of which
ripple into runtime or build behaviour. Phase R.7's
`r7-docker-ci-build.test.ts` already exercises build-config rebrand
contracts; the surface-text and asset-path tests cover renderer
bundling. R.9 adds no new build surface.

## 10. Remaining risks

- **Manual click-through deferred.** The goal allows `TBD: manual
  verification` for R.9 in autopilot mode. The three replacement URLs
  all point at `https://github.com/agisota/rox-one-terminal` and its
  standard sub-paths (`/pulls`, `#troubleshooting`); these are the same
  repo every other rebrand artifact uses, so the destinations are known
  alive. A follow-up note is recorded in the PR description so an
  operator can confirm in the browser when convenient.
- **Placeholder destinations unused.** The goal authorised
  `discord.gg/rox-one`, `x.com/rox_one`, `rox.one/community` as
  placeholders if canonical destinations did not yet exist. R.9 needed
  none of these — every replacement landed on a real ROX.ONE-owned
  destination. Future tickets that surface user-facing community
  language (e.g. P.4 launch announcement template) will need to revisit
  the placeholder policy.
- **Audit narrowness.** The audit test scans for the patterns enumerated
  in the goal plus the two upstream-repo patterns the inventory
  uncovered. It does not enforce the universe of every possible
  community link (e.g. Reddit, Mastodon, LinkedIn). If future tickets
  add such links the audit regex set can be extended; that is out of
  scope for R.9.
- **SessionManager.ts:680 line allowlist.** The narrow per-line
  allowlist for one developer-facing JSDoc bug-trace is the only
  exception inside an in-scope source file. The allowlist key is the
  exact substring `See: https://github.com/lukilabs/rox-agents-oss/issues/39`,
  so any future edit that changes the format of that comment (e.g.
  reworded prose) will re-trigger the audit failure and force the
  operator to either keep the format or remove the upstream reference.
  That is the desired behaviour.
- **Discord/Slack docs in automations.md.** The `ROX_WH_DISCORD_URL`
  example continues to mention Discord. The audit does not flag this
  because it is generic third-party webhook documentation; the
  `ROX_WH_*` env-var namespace itself is owned by R.6 / future
  env-var renames, not R.9.

## 11. Acceptance criteria matrix

- [x] `scripts/__tests__/community-link-audit.test.ts` exists and fails
      before the REPLACE edits land (verified red output captured in §5).
- [x] After the REPLACE edits, the test is green (3 pass, 0 fail in §8).
- [x] `docs/release/rebrand-mapping-2026-05-13.md` carries the
      "Legal preserve — community links (R.9 closeout)" section with
      the REPLACE table, the PRESERVE table, and the placeholder /
      verification notes.
- [x] `bun run typecheck` and `bun run lint` are green.
- [x] `.swarm/master-roadmap-log.md` carries the R.9 ledger line.
- [x] Three REPLACE hits across two source files (verified by
      `git diff --stat`).
- [x] Zero placeholder URLs used (every replacement points at a live
      ROX.ONE-owned destination).
