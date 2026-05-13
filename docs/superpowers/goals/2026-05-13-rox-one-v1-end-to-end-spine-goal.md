# Codex `/goal` — ROX.ONE v1.0.0 End-to-End Spine Roadmap

**Date:** 2026-05-13
**Author:** Architecture lane
**Status:** Canonical spine — supersedes the global picture of every prior roadmap document
**Audience:** Codex CLI in autonomous `/goal` mode (or human operator)

## Mega-Objective

Drive the `rox-one-terminal` repository from its current state (`origin/main` at or after `61016f9` Merge PR #46 R.0 closeout) to a public, tagged, signed **`v1.0.0`** GitHub Release with git history rewritten to remove every legacy `Craft Agents` / `craft-agent` reference, while preserving Apache 2.0 attribution. Execute in 33 ordered phases across two lanes (Master M and Rebrand R) plus six post-release lane items (P) — no phase is "out of scope"; everything ships before this `/goal` finishes.

## User-locked decisions (2026-05-13)

These are non-negotiable for the entire spine run. They were locked by the operator before the rebrand `/goal` was authorized.

| # | Decision | Locked value | Notes |
|---|---|---|---|
| 1 | **Canonical brand token** | `ROX.ONE` (wordmark, with dot) + `ROX ONE` (spoken form) | Wordmark goes everywhere written: README, code, `package.json`, ADRs, brand assets. Spoken form is for voice-over / marketing audio only and does not appear in code. |
| 2 | **Package scope** | `@rox-one/*` (kebab-case) | Matches the existing `@rox-one/marketing` package already in the workspace. |
| 3 | **Coordination — Lane R waits for Lane M Phase 1** | `T223-c4-followups-closeout` must be `Status: DONE` before any R-phase runs | **Now satisfied** at `f9ea575`. Rebrand is unblocked. |
| 4 | **Git history rewrite** | Authorized via `git filter-repo` in Phase R.11, **as the last step before the v1.0.0 tag** | The operator explicitly waived the CLAUDE.md "never force-push to main" rule for this one-time pre-release cleanup. R.11 has nine hard prerequisites and a two-pass backup procedure documented in the rebrand-sweep detail file. |

## Read first (once, before any phase)

1. `AGENTS.md` — operating contract (TDD loop, ticket+worklog discipline, 11-section worklog, Lore commit protocol).
2. `plan.md` §1 (Target Definition) — the canonical product description and North Star (VDI).
3. `LICENSE`, `NOTICE`, `TRADEMARK.md` — the **legal-preserve boundary**. Read these in full and never modify them outside the explicit allowlist exception in R.0.
4. `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md` — canonical *phase-detail* reference for master-roadmap phases **M.1 through M.21**. The spine owns sequencing; this file owns each phase's work breakdown.
5. `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` — canonical *phase-detail* reference for rebrand phases **R.0 through R.11**. Same separation: spine owns sequencing, this file owns each phase's work breakdown.
6. `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md` — ADR for the C.4 substrate that all M-phase work builds on.
7. The dependency graph: `docs/release/v1-end-to-end-dependency-graph.md` (sibling artifact authored with this file).
8. `.swarm/master-roadmap-log.md` — the resumption ledger. Every phase closeout appends one line; resumption reads the last line to know where to pick up.

## Discipline (inherited from `AGENTS.md`, applies to every phase)

- **One ticket per logical change** in `docs/tickets/<TASK>.md`. Ticket numbering schema is locked below.
- **One worklog per ticket** in `docs/worklog/<TASK>.md` following the **11-section format**.
- **TDD-first.** Every implementation ticket adds the failing test first, confirms it fails for the right reason, then implements the minimal change.
- **Atomic Lore-style commits.** One ticket = one commit (or a tight series tagged in the worklog).
- **No direct `main` pushes** except in Phase R.11. Every phase opens a feature branch named per its lane convention (`feat/M-<n>-<slug>`, `chore/rebrand-R<n>-<slug>`, `docs/spine-<slug>`, etc.) and merges via PR after the phase's stopping condition is green.
- **No cross-lane interleaving.** Codex must complete the active phase fully (closeout ticket → DONE → log entry appended) before moving to a phase in a different lane.
- Use the explorer-subagent pattern when entering an unfamiliar surface; do not modify unrelated runtime files.

## Mandatory phase pre-check (run before every phase in this spine)

Before starting **any** phase (M.x, R.x, P.x), run this resumption check:

1. Read `.swarm/master-roadmap-log.md` from the top.
2. The last line names the most recently completed phase. The phase the spine wants you to do next is the *next* row in the phase ledger below.
3. If every ticket for the target phase is already `Status: DONE`, verify each ticket has a matching 11-section worklog and a referenced commit SHA on `origin/main`.
4. If the phase is complete but `.swarm/master-roadmap-log.md` lacks an entry for it, append one line in this format and commit only that log update:

   ```text
   <phase-key> | <commit-sha> | <ticket-list> | <ISO-8601 UTC timestamp>
   ```

5. If the log line already exists, do not duplicate it; skip to the next phase.
6. If any phase ticket is not `Status: DONE`, resume from the first incomplete ticket in that phase.

This pre-check is the required DONE-phase skip-and-log block for every phase in this spine. It prevents resumed `/goal` runs from redoing already-landed phases or silently losing closeout evidence.

## Global validation matrix (run before claiming any phase green)

- `bun test <impacted test files>`
- `bun run typecheck`
- `bun run lint`
- `bun test` (full suite) when the phase changed runtime code; documentation-only phases skip the full suite but still run targeted tests.
- `bun run build` when the phase changed source/runtime behavior.
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run validate:rebrand` (added in Phase R.0; greps for forbidden tokens outside the legal-preserve allowlist)
- `bun run validate:roadmap` (added by the spine; asserts phase/ticket coherence across the three roadmap files)
- `git diff --check`

The spine stops for human review any time a global gate regresses by more than one test relative to the previous green baseline.

## Step zero (do this once before any phase)

```bash
git -C . switch main
git -C . pull --ff-only origin main
git -C . log --oneline | head -20
```

Confirm the master-roadmap Phase 1 closeout is on main:

```bash
git -C . log --oneline | grep -E "Close the C4 follow-up record|T222-c4-followups-closeout" \
  || echo "BLOCKED: T222 closeout missing. STOP and report."
```

Confirm the lint gates exist (R.0 ships them):

```bash
test -x scripts/validate-rebrand.cjs        || echo "BLOCKED: validate-rebrand.cjs missing — run R.0 first"
test -x scripts/validate-roadmap-coherence.cjs \
                                            || echo "BLOCKED: validate-roadmap-coherence.cjs missing — merge the spine PR first"
```

If any check fails, **stop and report**.

---

# The full phase ledger (33 phases, in canonical execution order)

| Lane | Phase | Title | Status | Owner file | Closeout ticket | Commit SHA (if done) |
|---|---|---|---|---|---|---|
| M | M.1.1 | Workspace RPC full scope migration | ✓ DONE | master-roadmap | T213 | `8c1edf9` |
| M | M.1.2 | Electron main handlers scope migration | ✓ DONE | master-roadmap | T214 | `9b29b30` |
| M | M.1.3 | Server-core RPC handlers scope migration | ✓ DONE | master-roadmap | T215 | `ee47a29` |
| M | M.1.3b | Pi IPC scope propagation | ✓ DONE | master-roadmap | T216 | `5e8b17a` |
| M | M.1.4 | Tenant credential KDF | ✓ DONE | master-roadmap | T217 | `baee220` |
| M | M.1.5 | Queryable audit storage backend (4 sub-commits) | ✓ DONE | master-roadmap | T218-T221 | `1e3c76e..ee49153` |
| M | M.1.6 | Multi-tenant data migration tool | ✓ DONE | master-roadmap | T222 | `9ffb0a3` |
| M | M.1.7 | Phase 1 closeout | ✓ DONE | master-roadmap | T223 | `f9ea575` |
| R | R.0 | Canonical brand decision + ADR 0011 + `validate:rebrand` gate | ✓ DONE | rebrand-sweep | T260-T262 | `61016f9` |
| R | R.1 | Surface text completion (i18n, READMEs, HTML titles, log paths) | ✓ DONE | rebrand-sweep | T263 | `4f02515` |
| R | R.2 | Code identifier renames (`CraftAppIcon` → `RoxAppIcon` etc.) | ✓ DONE | rebrand-sweep | T264-T266 | `3d945c4` |
| R | R.3 | Asset file renames (`craft-logos/`, binaries, doc filenames) | NEXT | rebrand-sweep | T267-T268 | — |
| R | R.4 | Documentation / decision-record / plan cleanup | QUEUED | rebrand-sweep | T269-T272 | — |
| R | R.5 | Package scope rename `@craft-agent/*` → `@rox-one/*` (11 sub-phases) | QUEUED | rebrand-sweep | T273-T284 | — |
| R | R.6 | Env-var rename `CRAFT_*` → `ROX_*` with `readEnv()` shim | QUEUED | rebrand-sweep | T285-T288 | — |
| R | R.7 | Docker / CI / build rebrand | QUEUED | rebrand-sweep | T289-T291 | — |
| R | R.8 | User-data migration shim `~/.craft/` → `~/.rox/` | QUEUED | rebrand-sweep | T292-T294 | — |
| R | R.9 | Community-link audit (preserve Apache 2.0 attribution) | QUEUED | rebrand-sweep | T295 | — |
| R | R.10 | Final rebrand sweep + permanent CI/pre-push gate | QUEUED | rebrand-sweep | T296-T297 | — |
| M | M.2 | RBAC slice 6 (populates `session.permittedWorkspaces`) | QUEUED | master-roadmap | T223-T229 | — |
| M | M.3 | Upstream merge v0.9.3 (supersedes v0.9.1 target in `plan.md`) | QUEUED | master-roadmap | T230-T232 | — |
| M | M.4 | Account persistent session storage | QUEUED | master-roadmap | T063 | — |
| M | M.5 | Public share shortlink | QUEUED | master-roadmap | T064 + T084 | — |
| M | M.6 | Production persistence adapter | QUEUED | master-roadmap | T065 | — |
| M | M.7 | Real provider orchestration | QUEUED | master-roadmap | T067 | — |
| M | M.8 | Durable mission scheduler | QUEUED | master-roadmap | T066 | — |
| M | M.9 | Experience Layer real-state binding | QUEUED | master-roadmap | T068, T074-T080 | — |
| M | M.10 | Composer Pillar 4 | QUEUED | master-roadmap | T233 + cluster | — |
| M | M.11 | F.1 Shiki migration | QUEUED | master-roadmap | T241-T242 | — |
| M | M.12 | Visual polish v2 | QUEUED | master-roadmap | T069 + T081 | — |
| M | M.13 | Security and abuse hardening | QUEUED | master-roadmap | T038, T052, T071, T086 | — |
| M | M.14 | Observability + audit trail (consumes M.1.5 substrate) | QUEUED | master-roadmap | T039 | — |
| M | M.15 | Test stabilization + E2E suites | QUEUED | master-roadmap | T034, T051, T082 | — |
| M | M.16 | Bundle + performance budget | QUEUED | master-roadmap | T092, T118, T124 | — |
| M | M.17 | Private CI/CD release pipeline | QUEUED | master-roadmap | T070, T085 | — |
| M | M.18 | Mac private release trust boundary | QUEUED | master-roadmap | T033, T121, T122 | — |
| M | M.19 | Final RC documentation and build | QUEUED | master-roadmap | T072, T087 | — |
| M | M.20 | RC validation + tag `v1.0.0-rc.1` + 72h soak | QUEUED | master-roadmap | T-rc-validation | — |
| R | R.11 | Git history rewrite via `git filter-repo` (USER-AUTHORIZED FORCE-PUSH) | QUEUED | rebrand-sweep | T298 | — |
| M | M.21 | `v1.0.0` release: tag, GitHub Release, CHANGELOG.md | QUEUED | master-roadmap | T-v1-release | — |
| P | P.1 | v1.1.0 planning kickoff | QUEUED | spine | T300 | — |
| P | P.2 | Security maintenance cadence (monthly cycle) | QUEUED | spine | T301 | — |
| P | P.3 | Upstream auto-merge automation (weekly cycle) | QUEUED | spine | T302 | — |
| P | P.4 | Public release announcement (72h after v1.0.0 tag) | QUEUED | spine | T303 | — |
| P | P.5 | Community onboarding pack | QUEUED | spine | T304 | — |
| P | P.6 | External contributor gate | QUEUED | spine | T305 | — |

**46 phases total** when including the M.1 sub-phases and the R.0 closeout. Of these, **9 are already DONE** (M.1.1 through M.1.7 plus R.0); **37 remain**. The next phase is **R.1**.

## Concurrency rules (the spine's hard constraints)

1. **R-phases and M-phases never run concurrently.** The rebrand's import-graph mutations would collide with master-roadmap work in shared packages. Codex's `/goal` must fully complete the active phase (closeout ticket → DONE → log entry appended) before moving to a phase in the other lane.
2. **R.5 sub-phases are strictly sequential.** Two open `@craft-agent/*` rename PRs invalidate each other's import paths the moment one merges. R.5.1 → R.5.2 → ... → R.5.11 in order, one PR open at a time.
3. **R.11 has nine hard prerequisites** documented in the rebrand-sweep detail file. R.11 cannot start until R.0–R.10 are all DONE *and* M.2–M.20 are all DONE *and* every open PR is merged or closed *and* no active codex `/goal` run is on the repo.
4. **M.3 (upstream merge) runs ONLY AFTER R.5–R.7.** Otherwise the upstream merge re-introduces `@craft-agent/*` and `CRAFT_*` from the upstream codebase.
5. **M.14 (observability) consumes M.1.5 substrate** (the queryable audit storage backend landed in M.1.5a–d). M.1.5 is already DONE, so M.14 is unblocked the moment its predecessors (M.2-M.13) land.
6. **P.4 (public announcement) runs only after v1.0.0 has been live for 72h without rollback signal.**

## Ticket numbering schema (locked by the spine)

| Range | Owner | Status |
|---|---|---|
| T000–T199 | Historical (T041 Experience Layer wave + T100s release-hardening) | Frozen |
| T200–T201 | Dependency alerts + unit validation | DONE |
| T202–T212 | C.4 implementation | DONE |
| T213–T222 | C.4 follow-ons + closeout | DONE |
| T223–T259 | Master roadmap Phases 2–21 | Defined in master-roadmap detail file |
| T260–T298 | Rebrand sweep R.0–R.11 | Defined in rebrand-sweep detail file |
| **T299** | **This spine file's integration ticket** | Defined here |
| **T300** | v1.1.0 planning kickoff (Lane P.1) | Defined here |
| **T301** | Security maintenance cadence (Lane P.2) | Defined here |
| **T302** | Upstream auto-merge automation (Lane P.3) | Defined here |
| **T303** | Public release announcement (Lane P.4) | Defined here |
| **T304** | Community onboarding pack (Lane P.5) | Defined here |
| **T305** | External contributor gate (Lane P.6) | Defined here |
| T306–T320 | Reserved for v1.1 scope items emerging from P.1 | Reserved |

Coherence is enforced by `scripts/validate-roadmap-coherence.cjs`: every ticket ID mentioned in any roadmap file must be unique across all three files, and every phase must have at least one ticket in its owning file.

## Risk register (severity × likelihood)

| # | Risk | Sev | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | R.5 package rename collides with upstream merge (M.3) | High | Med | Enforce M.3 strictly after R.5–R.7 via the coherence validator and the concurrency rule. |
| 2 | R.11 force-push corrupts main | High | Low | Two-pass backup (tag + branch + offline mirror), `--force-with-lease`, three legal-preserve byte-diffs (LICENSE/NOTICE/TRADEMARK.md), Dockerfile attribution URL grep. All documented in the rebrand-sweep file. |
| 3 | T222 closeout missed by a phase pre-check | Low | Low | Mandatory phase pre-check block (this file) reads `.swarm/master-roadmap-log.md` and refuses to proceed without it. |
| 4 | Apache 2.0 attribution silently scrubbed in R.11 | High | Low | Three byte-diffs run BEFORE the force-push fail closed. Documented in rebrand-sweep R.11. |
| 5 | Phase numbering drift across three roadmap files | Med | Med | `validate:roadmap` script lints uniqueness and topology on every PR. |
| 6 | Codex picks wrong phase on resume after a long idle | Low | Med | Mandatory phase pre-check + `.swarm/master-roadmap-log.md` is canonical. |
| 7 | Stale PRs (#16–#29 from 2026-05-09) confuse the merge graph | Low | High | T299 includes a sweep to either rebase or close them with a comment. |
| 8 | v1.0.0 release blocker emerges in M.20 RC validation | High | Med | M.20 stopping condition gates the v1.0.0-rc.1 tag; blocker becomes its own ticket and re-enters the queue. |
| 9 | Upstream v0.9.3 has a security CVE that M.3 must absorb | Med | Med | M.13 sweeps upstream advisories during the merge window. |
| 10 | Post-release security cadence (P.2) underfunded | Med | High | Define P.2 as monthly recurring with a named owner before the v1.0.0 tag. |
| 11 | Working tree dirty during a phase switch loses uncommitted codex work | Med | Med | Pre-check reads `git status --porcelain`; if non-empty, refuse to proceed and instruct the operator to commit or stash. |
| 12 | Phase R.6 deprecation warning interferes with test assertions on clean stderr | Low | Med | R.6's ticket adds a test-only env var to suppress the warning during `bun test`. |

## Release timeline (target dates assuming current cadence)

| Phase | Target completion | Notes |
|---|---|---|
| **DONE: M.1.1 → R.0** | 2026-05-13 | Already landed on `main` |
| R.1 | 2026-05-14 | In flight (codex has uncommitted modifications + ticket files for T263) |
| R.2 | 2026-05-15 | Component renames |
| R.3 | 2026-05-16 | Asset renames |
| R.4 | 2026-05-17 | Doc cleanup |
| R.5 | 2026-05-18 to 2026-05-22 | Eleven sub-phases, one PR each, sequential |
| R.6 | 2026-05-23 | Env-var shim + call-site migration |
| R.7–R.9 | 2026-05-24 to 2026-05-25 | Docker / CI / migration shim / community-links |
| R.10 | 2026-05-26 | Final sweep + permanent CI gate |
| M.2 | 2026-05-27 to 2026-05-29 | RBAC slice 6 |
| M.3 | 2026-05-30 to 2026-06-02 | Upstream v0.9.3 merge |
| M.4–M.9 | 2026-06-03 to 2026-06-15 | Account, share, persistence, providers, scheduler, Experience |
| M.10–M.12 | 2026-06-16 to 2026-06-22 | Composer Pillar 4, Shiki, visual polish |
| M.13–M.16 | 2026-06-23 to 2026-06-28 | Security, observability, tests, bundle |
| M.17–M.19 | 2026-06-29 to 2026-07-02 | CI/CD, Mac trust boundary, RC docs |
| M.20 | 2026-07-03 to 2026-07-05 | RC validation + tag `v1.0.0-rc.1` + 72h soak |
| R.11 | 2026-07-06 | Force-push to main, the destructive step |
| **M.21** | **2026-07-07** | **`v1.0.0` tag + GitHub Release** |
| P.1 | 2026-07-08 to 2026-07-15 | v1.1.0 planning sprint |
| P.4 | 2026-07-10 (after 72h soak) | Public announcement |
| P.2/P.3/P.5/P.6 | 2026-07-15 onward | Continuous post-release cadence |

**Total elapsed from today (2026-05-13) to `v1.0.0` tag: 55 days.** Largest single block: R.5 (~5 days of sequential package renames). Second largest: M.3 (upstream merge with manual ROX-surface re-application).

## Post-release Lane P (defined here in the spine, not in any detail file)

### P.1 — v1.1.0 planning kickoff (T300)

Open `docs/superpowers/specs/2026-07-08-v1-1-roadmap-design.md`. Inventory the v1.1 scope from issues filed against v1.0.0 during the 72h soak, prioritize by impact, and produce a new master-roadmap-style goal file. Allocate T306–T320 across the v1.1 work.

### P.2 — Security maintenance cadence (T301)

Set up a monthly recurring GitHub Action (`.github/workflows/security-maintenance.yml`) that runs `npm audit --workspaces`, `trufflehog filesystem .`, and the dependency-license scanner. The job opens an issue tagged `security/monthly` if any finding has severity >= moderate. Named owner: the SRE-on-call rotation defined in `docs/decision-records/audit-harness/0012-security-maintenance-cadence.md` (authored as part of P.2).

### P.3 — Upstream auto-merge automation (T302)

Weekly GitHub Action that fetches `upstream/main` from `craft-ai-agents/craft-agents-oss`, runs `git merge --no-ff --strategy=ort -X theirs upstream/main` into a `chore/upstream-weekly-<date>` branch, runs the global validation matrix, and opens a PR if green. If conflicts arise in any protected ROX-owned surface (per the list in the rebrand-sweep R.4 phase and `plan.md §6.2`), the job stops and pings the owners.

### P.4 — Public release announcement (T303)

Blog post on `rox.one/blog`, X thread, Discord announcement in the official server, docs site update banner. **Gated by 72h soak without rollback signal** after the v1.0.0 tag. The announcement template lives in `docs/release/templates/v1-launch-announcement.md`, authored as part of P.4.

### P.5 — Community onboarding pack (T304)

Contributor guide, good-first-issue tagging pass, mentor pool list. Live at `docs/community/`. Includes:
- `CONTRIBUTING.md` (already exists but rebranded in R.4) — adds a "Your first contribution" section.
- `docs/community/good-first-issues.md` — curated list of issues suitable for new contributors.
- `docs/community/mentor-pool.md` — list of maintainers willing to review first PRs from external contributors.

### P.6 — External contributor gate (T305)

Open the codebase to selected external contributors. Gated by P.5 (must have onboarding pack live) and a signed CLA process. CLA implementation lives in `docs/community/cla.md` with a GitHub App hook that blocks PRs from contributors without a signed CLA.

## Validation script for the spine itself

`scripts/validate-roadmap-coherence.cjs` (authored as part of T299):

1. Parse all three roadmap files (`docs/superpowers/goals/2026-05-13-*-goal.md`).
2. Extract every phase ID (regex `^### Phase [MR]\.[0-9]+(\.[0-9]+)?` or `^[#]+ Phase [MR]\.…`).
3. Extract every ticket ID (regex `T[0-9]{3}-[a-z0-9-]+`).
4. Assert:
   - Every phase ID in the spine ledger has a matching `# Phase` heading in its owner file.
   - Every ticket ID appears in exactly one roadmap file (the file that "owns" its phase).
   - The phase sequence in the spine ledger forms a valid topological order against the dependency graph in `docs/release/v1-end-to-end-dependency-graph.md`.
5. Exit non-zero on any violation; print the offending phase or ticket and the file it appeared in.

Wired into the global validation matrix and into the prepush hook by Phase R.10 (the same hook that enforces `validate:rebrand`).

## The `/goal` invocation (single short line to paste into Codex)

```
/goal follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md
```

That's 102 characters — well under codex's 4 000-char limit. The spine then dispatches each phase to its owner detail file via the "Read first" list at the top.

## Stop and ask if

- A phase's design spec is ambiguous and the owner detail file does not resolve the ambiguity.
- A regression suite cannot be made deterministic inside the phase's allowed file boundary.
- Step zero fails (cannot fast-forward `main`).
- A production dependency or service credential is needed and not present in the environment.
- A merge conflict during Phase M.3 (upstream merge) requires a human ROX-surface decision.
- Any security test in Phase M.13 fails closed and the root cause is outside the phase's allowed boundary.
- A scenario in Phase M.20 fails and the fix would expand the phase scope by more than three new tickets.
- The working tree is dirty when a phase pre-check runs — refuse to proceed; instruct the operator to commit or stash.
- The CLAUDE.md "no direct main pushes" rule conflicts with an immediate need — the answer is **always** "open a PR" except in Phase R.11 where the operator's prior waiver applies.

## Resumption protocol (if Codex is restarted mid-run)

1. Read `.swarm/master-roadmap-log.md`; the last line names the most recently completed phase.
2. Verify the listed commit SHA via `git log --oneline | grep <sha>`.
3. Re-run Step zero (fast-forward `main`, check T222 closeout, check lint gates exist).
4. Re-read this spine file and the next phase's *owner detail file*.
5. Resume from the first phase whose closeout ticket is not yet `Status: DONE`.

## Global stopping condition

All of:

1. Every phase in the ledger above is `Status: DONE` with matching worklogs and commit SHAs on `origin/main`.
2. `bun run validate:rebrand`, `bun run validate:roadmap`, `bun run typecheck`, full `bun test`, `bun run lint`, `bun run build`, `bun run validate:docs`, `bun run validate:agent-contract` are all green on the post-R.11 main.
3. `v1.0.0` tag exists on `origin/main` (re-pointed to the post-rewrite SHA in R.11).
4. `pre-rebrand-history-rewrite-backup` tag exists on `origin` and the offline mirror at `/tmp/rox-one-terminal-backup-<date>.git` is preserved for at least 90 days.
5. GitHub Release for `v1.0.0` is published with CHANGELOG generated from Conventional Commits.
6. P.4 announcement is live on `rox.one/blog` and the Discord/X/docs site.
7. `.swarm/master-roadmap-log.md` has one final entry: `spine-closeout | <v1.0.0-tag-sha> | T299..T305 | <ISO-8601 UTC>`.

When all seven conditions hold, the `/goal` exits. The repository is at `v1.0.0`, history is rebranded, post-release lanes are running on schedule.
