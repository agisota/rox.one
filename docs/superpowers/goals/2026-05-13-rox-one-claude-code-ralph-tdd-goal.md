# Claude Code Goal — ROX.ONE v1.0.0 Ralph + TDD Cycle Driver

**Date:** 2026-05-13
**Author:** Delivery lane
**Sibling of:** `2026-05-13-rox-one-v1-end-to-end-spine-goal.md` (the canonical ledger)
**Status:** Active — invokable as a Claude Code `/goal` or via `/oh-my-claudecode:ralph`
**Cycle budget:** 10 cycles (default) or up to 20 (extended)

## North Star

The product North Star is unchanged from `plan.md §1`:

```text
Verified Deliverable Index (VDI)
```

with submetrics: Quality Score, Execution Readiness, Open Risk Score, Cost Efficiency, Noise Score, Trust / Mastery / XP.

This goal adds a **delivery North Star** for measuring autonomous progress between Claude Code sessions:

```text
% of spine ledger phases at Status: DONE on origin/main with green validation gates
```

A perfect score is reached when **every** phase in the spine ledger (`docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`) is `DONE` *and* the `v1.0.0` tag exists on `origin/main`. As of this goal's authoring (post `aaa6272` Merge PR #61 R.5.10), the score is approximately:

```
9 of 46 phases DONE   ... pre-spine baseline (M.1.x + R.0)
+11 phases DONE       ... R.1, R.2, R.3, R.4, R.5.1..R.5.7 (via codex sessions)
+ 3 phases DONE       ... R.5.8, R.5.9, R.5.10 (just landed via PRs #59-#61)
= 23 of 46 phases DONE  (~50%)
```

23 phases remain: R.5.11 + R.6 + R.7 + R.8 + R.9 + R.10 + R.11 + M.2..M.21 + P.1..P.6. **This goal targets up to 20 of those in a single Ralph session.**

## Coverage statement — *everything in scope*

This goal explicitly inherits **every ticket and every phase** already encoded in the repo. There is **no out-of-scope** carve-out in this delivery driver. Specifically:

- **Historical tickets** T000–T199 — already DONE; Ralph reads them only for context.
- **Tracked tickets** T200–T222 — all DONE (C.4 implementation + follow-ons closeout).
- **In-flight ticket clusters** T260–T298 — Lane R (rebrand sweep); Ralph drives the next QUEUED phase.
- **Future ticket clusters** T213–T251 (Lane M post-rebrand), T299–T320 (Lane P post-release) — Ralph creates these on demand as their phases come up.
- **Definition of Done criteria** from `plan.md §2` — every line ships before `v1.0.0`.
- **All new features authored during this autonomous run** — drafted under Ralph's TDD discipline, no exceptions.

If during a cycle Ralph identifies a feature/ticket/phase NOT yet enumerated in the spine ledger, it **adds a row to the ledger** and proceeds — never silently skips.

## Cycle protocol (each Ralph iteration)

The cycle limit is 10 by default, settable to 20 via the invocation arg. Each cycle is a complete TDD-first phase delivery.

### Cycle steps

**Step 1 — Resumption pre-check** (from spine §"Mandatory phase pre-check"):

1. `git fetch origin && git pull --ff-only origin main`
2. Read `.swarm/master-roadmap-log.md` (last line names the most recently completed phase)
3. Find the **first** phase in the spine ledger whose status is *not* `DONE` and whose dependencies (per the dependency graph) are all `DONE`. That is **THIS cycle's target phase**.
4. If no such phase exists → check the global stopping condition (does `v1.0.0` tag exist on origin?). If yes → SUCCESS, exit cycle loop. If no → write a blocker report and STOP.

**Step 2 — Phase context load:**

1. Read the spine ledger row for the target phase (owner detail file + closeout ticket).
2. Open the owner detail file's section for this phase.
3. Read every cross-reference: predecessor phases' worklogs, related ADRs, the design spec under `docs/superpowers/specs/`.

**Step 3 — TDD red:**

1. Open or create the phase's closeout ticket at `docs/tickets/T<id>-<slug>.md` using `docs/tickets/TEMPLATE.md`.
2. Write the failing test(s) per the phase's *stopping condition*. Tests live at the path conventions documented in `AGENTS.md`.
3. Run the focused test command. **Confirm it fails for the right reason** (missing implementation, not a wiring bug). Record the failure output verbatim into the worklog's section 5 (expected failing test output).

**Step 4 — TDD green (minimal implementation):**

1. Implement the smallest change that turns the test green, scoped to the phase's *file list* and *boundary*. Do **NOT** touch unrelated runtime files; do **NOT** modify legal-preserve files (`LICENSE`, `NOTICE`, `TRADEMARK.md`, `Dockerfile.server` source-URL label).
2. Re-run the focused test. It should pass.
3. Run targeted tests adjacent to the change (sibling test files, integration tests that import the changed module).

**Step 5 — Validation matrix** (from spine §"Global validation matrix"):

Run all that apply to the phase:

- `bun test <focused + adjacent test files>`
- `bun run typecheck`
- `bun run lint`
- `bun test` (full suite — required when phase touched runtime code)
- `bun run build` (required when phase touched source/runtime behavior)
- `bun run validate:agent-contract`
- `bun run validate:docs`
- `bun run validate:rebrand`
- `bun run validate:roadmap`
- `git diff --check`

If any gate regresses by **more than 1 test** relative to the last green main → **STOP** and report. Do not attempt to silence the regression.

**Step 6 — Worklog (11-section format):**

Write `docs/worklog/T<id>-<slug>.md` capturing:

1. Task summary
2. Repo context discovered
3. Files inspected
4. Tests added first
5. Expected failing test output (verbatim from step 3)
6. Implementation changes
7. Validation commands run
8. Passing test output summary
9. Build output summary (if applicable)
10. Remaining risks
11. Acceptance criteria matrix

The acceptance criteria matrix must include one row per stopping-condition bullet from the phase's owner detail file. Every row is Pass/Fail with evidence.

**Step 7 — Atomic commit + branch:**

1. Create branch `<lane>/<phase-key>-<slug>` per the spine's conventions (e.g. `chore/rebrand-R5.11-app-package-scopes` or `feat/M2-rbac-roles-schema`).
2. Stage only files relevant to this phase via explicit `git add <path>` (never `git add .` or `git add -A`).
3. Verify staged set with `git diff --cached --name-only`.
4. Commit with Conventional Commits prefix + Lore body referencing the phase, ticket, and validation evidence. Include the Co-Authored-By line.
5. `git push -u origin <branch>`.

**Step 8 — PR open and self-review:**

1. `gh pr create --base main --head <branch> --title ... --body ...` with a body that lists: phase, ticket, files changed, validation commands run, test output summary, link to the spine ledger row.
2. Run a focused self-review: re-read the diff line by line; confirm no unrelated changes, no legal-preserve violations, no stale TODO markers introduced.
3. If self-review reveals a defect → fix it on the same branch with another atomic commit before requesting merge.

**Step 9 — Merge readiness or pause:**

- If the user has authorized self-merge for this run, run `gh pr merge --squash` after self-review.
- If self-merge is **not** authorized, leave PR open and proceed to step 10. The user merges manually between cycles.

**Step 10 — Roadmap log append:**

Append one line to `.swarm/master-roadmap-log.md`:

```text
<phase-key>-<slug> | <merge-or-head-sha> | <ticket-list> | <ISO-8601 UTC>
```

Commit that one-line append in a tiny follow-up commit on `main` (or as part of the same PR if PR is still open). The spine's resumption protocol depends on this log being current.

**Step 11 — Cycle close:**

1. Decrement cycle budget.
2. If budget > 0 AND spine has more `QUEUED` phases AND no hard blocker → go to Step 1 of next cycle.
3. Otherwise → exit with a summary report.

## TDD discipline (non-negotiable per cycle)

- **No code without a failing test first.** If the change is documentation-only or pure config (no test possible), instead write a **regression test in the validator script** (`scripts/validate-roadmap-coherence.cjs` or `scripts/validate-rebrand.cjs`) that fails before the doc/config edit and passes after.
- **Tests precede implementation in the commit history.** Step 3 commit (failing test) may be folded into the same commit as Step 4 (passing implementation) for atomicity, but the *worklog* must show the temporal order: failing output captured first, then the implementation diff.
- **No skipping or `xfail`/`.only`/`xit`** in the main branch.
- **Mocks only at system boundaries** (network, filesystem, external services). Internal contracts use real implementations.

## Ralph wrapper

This goal is designed to be invoked as `/oh-my-claudecode:ralph` with this file as the prompt body. Ralph's autonomous loop satisfies the "while QUEUED phases exist and cycle budget > 0" outer loop above; each Ralph iteration is one cycle as defined here.

If using a different driver (Claude Code's native `/goal`, or the `/oh-my-claudecode:autopilot` skill which routes through `ralplan → ralph → code-review`), the cycle protocol is identical — only the wrapper differs.

## Stopping conditions

### Cycle-level stop (this run ends)

- **Success:** `v1.0.0` tag exists on `origin/main` with all global-stopping-condition items from the spine met. Report and exit.
- **Budget exhausted:** Cycle counter reached 0. Report progress (which phases done, which still QUEUED, what was the last successful cycle), exit.
- **Hard blocker:** any of the spine's `Stop and ask if` triggers fired. Report, exit, await human.
- **Validation regression:** a gate failed and the failure root cause is outside the phase's allowed file boundary. Report, exit.

### Phase-level stop (this cycle ends, next cycle starts)

- Phase's stopping condition is met (every acceptance-criteria matrix row Pass).
- PR opened (and merged if self-merge authorized).
- Roadmap log appended.
- Validation matrix green.

## Hard rules (inherited)

- **No direct `main` pushes** except in Phase R.11 (already user-authorized for that one phase).
- **Legal-preserve files are read-only:** `LICENSE`, `NOTICE`, `TRADEMARK.md`, the `org.opencontainers.image.source` label in `Dockerfile.server`. The rebrand renames the *product*, not the *attribution*.
- **No silent dependency adds** — if a phase needs a new prod dependency, the phase stops and asks.
- **Historical tickets/worklogs are immutable** (T000–T199 and any DONE ticket from prior runs). New phases create new tickets.
- **R-phases and M-phases never run concurrently** in the same cycle. The spine's concurrency rules apply.
- **R.5 sub-phases are strictly sequential.** Cycle N+1's target phase must wait for cycle N's R.5.x PR to merge before starting R.5.(x+1).
- **R.11 git filter-repo is the last operation before M.21.** It will never be the target phase of an early cycle; the spine ledger ordering ensures this.

## Invocation

### Primary — via OMC Ralph (recommended, drives the cycle loop natively)

```text
/oh-my-claudecode:ralph
follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md
```

Default cycle budget: 10. To extend to 20:

```text
/oh-my-claudecode:ralph
follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md
cycle_budget=20
```

### Alternate — via OMC Autopilot (adds explicit ralplan→ralph→code-review per cycle)

```text
/oh-my-claudecode:autopilot
follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md
```

### Alternate — via Claude Code's native `/goal` (if available)

```text
/goal follow the instructions in docs/superpowers/goals/2026-05-13-rox-one-claude-code-ralph-tdd-goal.md
```

That single-line invocation is **127 characters** — well under any reasonable goal-text limit.

## Pre-run checklist (operator runs once before invocation)

1. **Local main in sync:** `git -C . fetch origin && git -C . switch main && git -C . pull --ff-only origin main`.
2. **Spine artifacts present:** `test -f docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md && test -f docs/release/v1-end-to-end-dependency-graph.md && test -x scripts/validate-roadmap-coherence.cjs`.
3. **Validation gates work:**
   - `node scripts/validate-roadmap-coherence.cjs` → exit 0 (or 1 with known stale-DONE rows that the spine ledger is allowed to lag on).
   - `bun run validate:rebrand` → exit 0 inside the legal-preserve allowlist.
4. **Working tree clean:** `git status --porcelain` returns empty.
5. **Cycle budget chosen:** default 10, extended 20 (only if operator has time to review 20 PRs).
6. **Self-merge policy:** decide whether Ralph self-merges after self-review (faster) or leaves PRs for operator merge (safer).
7. **Notify codex:** if codex is running on this repo via a different terminal/session, either pause it (`/goal pause`) or expect occasional rebase conflicts that this goal's TDD cycles will resolve.

## Expected outcome of a 10-cycle run (starting from `aaa6272`)

In rough order, 10 cycles would close:

1. **R.5.11** — final R.5 sub-phase (app package scopes: cli/electron/viewer/webui)
2. **R.6** — env-var rename + `readEnv()` shim
3. **R.7** — Docker/CI/build rebrand
4. **R.8** — User-data migration shim (`~/.rox/` → `~/.rox/`)
5. **R.9** — Community-link audit
6. **R.10** — Final rebrand sweep + permanent CI gate
7. **M.2** — RBAC slice 6 (consumes C.4's `session.permittedWorkspaces`)
8. **M.3** — Upstream merge v0.9.3 (largest single phase; may consume cycle budget faster than 1:1)
9. **M.4** — Account persistent session storage
10. **M.5** — Public share shortlink

That advances delivery from ~50% to ~72% (33 of 46 phases DONE) and leaves M.6–M.21 + R.11 + M.21 + P.1–P.6 for the next session.

A 20-cycle run extends through M.13 (security and abuse hardening), reaching ~83% (38 of 46 phases DONE).

## Notes for the human in the loop

- **Between cycles**, glance at the new PR's body — Ralph's self-review may have missed something subtle that a human can catch in 30 seconds.
- **Don't merge R.5.x out of order** — if Ralph opens R.5.11 and you have R.5.10 also open from a previous session, merge R.5.10 first or close it as superseded.
- **R.11 is special** — it will only run when its nine prerequisites in the rebrand-sweep detail file are all met. If Ralph picks R.11 as a target phase before then, it will stop and ask.
- **Lane P (post-release)** phases require `v1.0.0` to be tagged first. Ralph's pre-check enforces this dependency.

## Telemetry (to be appended after a Ralph session)

When a cycle session ends, paste a one-line summary into the project memory or `.swarm/master-roadmap-log.md`:

```text
<session-id> | <cycles-completed>/<cycle-budget> | <phases-closed-list> | <last-main-sha> | <ISO-8601 UTC>
```

This becomes the input to the next session's pre-check, ensuring no phase gets re-done and the delivery North Star metric (`% DONE on main`) is accurately tracked.
