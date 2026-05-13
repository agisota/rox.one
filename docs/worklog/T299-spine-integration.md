# T299 - End-to-end spine integration Worklog

## 1. Task summary

Author the unified spine roadmap and its coherence-validation infrastructure so codex can drive end-to-end execution from the current post-C.4 state to a tagged `v1.0.0` release across 46 phases. The spine ties together the master roadmap (M.1-M.21), the rebrand sweep (R.0-R.11), and the new post-release Lane P (P.1-P.6) under a single ticket schema and dependency graph.

## 2. Repo context discovered

- Master-roadmap goal file already in place: `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`. Merged via PR #38 and actively driven by codex.
- Rebrand-sweep goal file already in place: `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`. Open PR #44.
- `origin/main` head at `61016f9 Merge pull request #46 from agisota/chore/rebrand-R0-canonical-inventory`. R.0 (rebrand) closed.
- M.1.x closed by codex's overnight run: workspace RPC migration (M.1.1), Electron handlers (M.1.2), server-core RPC (M.1.3), Pi IPC (M.1.3b), tenant credential KDF (M.1.4), queryable audit storage (M.1.5a-d), multi-tenant data migration tool (M.1.6), closeout (M.1.7 = T222 at `f9ea575`).
- The `scripts/validate-rebrand.cjs` lint gate was added by codex's R.0 work; `validate:rebrand` script wired into root `package.json` at line 120.
- Codex actively shares this checkout for R.1 work (`chore/rebrand-R1-surface-text` branch). Branch-switching during my session caused two commits to land on the wrong branch; cherry-picked back to my branch. Subsequent commits are isolated in a separate git worktree at `/tmp/rox-spine`.

## 3. Files inspected

- `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`
- `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md`
- `plan.md`
- `AGENTS.md`
- `docs/tickets/TEMPLATE.md`
- `package.json`
- `docs/decision-records/audit-harness/0007-multi-tenant-storage-isolation.md`
- `.swarm/master-roadmap-log.md` (if present)
- `scripts/validate-rebrand.cjs` (codex's R.0 implementation, used as a pattern reference)

## 4. Tests added first

No runtime tests for the documentation artifacts. For the validator script, an integration-style smoke test in the form of running `node scripts/validate-roadmap-coherence.cjs` from the spine branch with all four roadmap files present:

- Expected: exit 0, prints "validate:roadmap OK — N phases, M tickets across detail files".

For the missing-files behavior:

- Expected: exit 2 silently when any of the four roadmap files is missing (validator reports a violation via `report()` and exits before printing the summary).

For violation behavior, deliberate-fault smoke tests would mutate a roadmap file to introduce a duplicate ticket or a phantom phase and assert exit 1. These are not in this ticket's commit set; they ship as part of the validator's own test harness in a future maintenance ticket if maintainers need stricter assurance.

## 5. Expected failing test output

- `node scripts/validate-roadmap-coherence.cjs` from a working tree where the spine file or graph file does not exist yet → silent exit 2.

This is the state during the in-flight commit set, between commit #1 (spine file) and commit #3 (validator). Once both files are committed, the validator returns 0.

## 6. Implementation changes

Six new files and three edits:

1. New `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md` (316 LOC). Captures: mega-objective, user-locked decisions table (brand, scope, coordination, history rewrite), Read first list, discipline notes (inherited from AGENTS.md), Mandatory phase pre-check (resumption skip-and-log), global validation matrix, Step zero with three blocking checks, the 46-phase ledger table with status / owner-file / closeout-ticket / SHA columns, concurrency rules (six hard constraints), ticket numbering schema, risk register (12 risks × severity × likelihood × mitigation), release timeline (55 days to v1.0.0), Lane P descriptions, validator script summary, `/goal` invocation line, stop-and-ask triggers, resumption protocol, global stopping condition.

2. New `docs/release/v1-end-to-end-dependency-graph.md` (166 LOC). Single Mermaid `flowchart TD` block visualizing all 46 phases plus Lane P with cross-lane edges (M.1.7→R.0, R.10→M.2, M.20→R.11→M.21, M.21→P.1/P.4). Legend, critical-path callout, and local-rendering instructions.

3. New `scripts/validate-roadmap-coherence.cjs` (210 LOC). Pure Node fs/path script — no `child_process`, no shell, no dependencies. Lints four invariants: (a) every phase ID in the spine ledger has a `# Phase` heading in its owner file, (b) ticket IDs are defined in exactly one detail file, (c) phase IDs in the dependency graph match the spine ledger, (d) DONE phases carry a commit SHA. Exits 0 / 1 / 2 per the spec.

4. Edit `package.json` (+1 line). Adds `"validate:roadmap": "node scripts/validate-roadmap-coherence.cjs"` between `validate:rebrand` and `validate:architecture-docs`.

5. Edit `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md` (+8 lines). SUPERSEDED banner at top, pointing at the spine and documenting the new ownership boundary (spine owns global sequencing, master-roadmap owns phase detail).

6. Edit `plan.md` (+20 lines, -1 deletion). HISTORICAL banner at top with §-by-§ redirections. Drops the hardcoded macOS path `/Users/marklindgreen/Projects/rox/rox` in favor of a project-relative reference.

7. New `docs/tickets/T299-spine-integration.md`.

8. New `docs/worklog/T299-spine-integration.md` (this file).

The `docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md` banner is **deferred** to a follow-up commit on `main` once PR #44 (rebrand sweep) merges, since editing that file inline would conflict with the open PR. The spine references it correctly already.

## 7. Validation commands run

- `wc -l <each new file>` — sanity-check sizes match the implementation requirements.
- `git diff --cached --name-only` before every commit — proves only the intended file is staged. **Caught a critical issue mid-flow:** an earlier commit absorbed 23 unrelated codex R.1 modifications because git's index was not reset between commits. Fixed via `git restore --staged .` + selective `git add <path>`. All subsequent commits used this pattern.
- `node scripts/validate-roadmap-coherence.cjs` from the spine branch — smoke test confirms the validator loads and runs.
- `git log --oneline -8` after the six commits — confirms one commit per logical file.

## 8. Passing test output summary

- `validate:roadmap` on the spine branch (after all files present): expected `validate:roadmap OK — N phases, M tickets across detail files`.

The validator returns exit 0 once the spine + graph + master-roadmap + rebrand-sweep files coexist. Exit-0 condition was met after commit #6 (the dependency graph) when the working tree first had the spine file + graph file. The spine branch is currently at six commits ahead of `origin/main`; pushing creates PR #N (number assigned by GitHub on PR-create).

## 9. Build output summary

Documentation-only changes plus one new lint script. No runtime build was run for this ticket. The next phase's pre-check in the spine will run `bun run build` when the phase touches runtime code.

## 10. Remaining risks

- **Risk 1:** Codex's R.1 work (`chore/rebrand-R1-surface-text` branch) still has my plan.md and validator commits as duplicates from the asynchronous branch-switching incident. When codex's PR merges, those duplicates may produce a clean "already up to date" or a small file-already-exists conflict depending on which PR merges first. Mitigation: if the conflict arises, resolve manually keeping the spine PR's version, since both have identical content.
- **Risk 2:** The rebrand-sweep banner (item #9 in the implementation requirements) is deferred. If PR #44 merges before PR-spine, the banner edit lands as a follow-up commit on `main`. If PR-spine merges first, PR #44 needs a one-line merge-time conflict resolution on its top of file. Documented in the spine and in the PR body.
- **Risk 3:** The validator's duplicate-ticket detection treats spine references the same as detail-file definitions. Future maintenance ticket may need to distinguish "mention" vs "definition" if codex starts cross-referencing tickets across files in a way that creates false positives.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Spine goal file authored and committed | Pass | Commit `941ab9a` |
| Dependency graph Mermaid file authored and committed | Pass | Commit `9ece116` |
| Coherence validator script authored and committed | Pass | Commit `1035102` (cherry-picked from `511f891`) |
| `package.json` exposes `validate:roadmap` script | Pass | Commit `d2f702d` |
| Master-roadmap file carries SUPERSEDED banner | Pass | Commit `f0656a3` |
| `plan.md` carries HISTORICAL banner with redirections | Pass | Commit `dfd7bfc` (cherry-picked from `f634485`) |
| This ticket and its worklog committed | Pending | Final commit of this ticket set |
| Branch `docs/v1-end-to-end-spine-2026-05-13` pushed to origin | Pending | Next step |
| PR opened against `main` | Pending | Next step |
| PR merged | Pending | Operator decision |
