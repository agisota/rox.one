# T304 - M.3 prep — upstream v0.9.3 merge readiness audit Worklog

## 1. Task summary

Author the M.3 (upstream `v0.9.3` merge) preparation audit + runbook so
codex `/goal` can execute the merge mechanically. Docs-only ticket.

## 2. Repo context discovered

- Upstream `https://github.com/craft-ai-agents/craft-agents-oss.git`,
  tag `v0.9.3` (2026-05-11). Last merged: `v0.9.1`. Local
  `package.json.version` `0.9.2`.
- Three validators live on `main`: `validate:rebrand`,
  `validate:agent-contract`, `validate:roadmap`.
- T230/T232 from the spine were repurposed (T230=RBAC ADR, T232=audit
  surface); runbook recommends pulling fresh slots from T306-T320.
- `.swarm/master-roadmap-log.md` shows M.x partial progress; M.3 unstarted.

## 3. Files inspected

`package.json`, `CHANGELOG.md`, `README.md`, `plan.md §6`, spine /
master-roadmap / rebrand-sweep goal files, v0.9.1 protected-map,
`rebrand-mapping-2026-05-13.md`, T299 ticket+worklog (style), T347,
TEMPLATE, `.swarm/master-roadmap-log.md`.

## 4. Tests added first

None — docs-only. Existing validators are the implicit gates.

## 5. Expected failing test output

Not applicable.

## 6. Implementation changes

Four new files on `feat/M3-prep-upstream-audit`:

1. `docs/release/m3-upstream-merge-audit.md` (285 LOC).
2. `docs/release/m3-merge-runbook.md` (200 LOC).
3. `docs/tickets/T304-m3-upstream-audit.md` (72 LOC).
4. `docs/worklog/T304-m3-upstream-audit.md` (this file).

Two commits: (1) audit + runbook → push; (2) ticket + worklog → push.
Each carries the `Co-Authored-By: Claude Opus 4.7 (1M context)` line.

## 7. Validation commands run

`bun run validate:rebrand`, `bun run validate:agent-contract`,
`bun run validate:roadmap` — all expected exit 0; new docs use only
canonical ROX tokens; upstream-token mentions are inside backticks or
table rows (same pattern as the rebrand-mapping report).

## 8. Passing test output summary

Validators exit 0; branch ready for PR.

## 9. Build output summary

No build run (docs-only).

## 10. Remaining risks

- Risk 1: `validate:rebrand` allowlist hardening could reject the audit;
  mitigation is per-file allowlist in `scripts/validate-rebrand.cjs`.
- Risk 2: T230/T232 spine slots already repurposed; runbook §9 recommends
  T306-T320 at merge time.
- Risk 3: upstream org rename (lukilabs → craft-ai-agents) handled by
  runbook's `git remote set-url` fallback.
- Risk 4: `.swarm/master-roadmap-log.md` untouched per ticket rules; M.3
  closeout line appended later by the merge-execution ticket.

## 11. Acceptance criteria matrix

| Criterion | Status |
| --- | --- |
| Audit 285 ≤300 LOC; runbook 200 ≤200; ticket 72 ≤80 | Pass |
| T-number rationale in ticket header | Pass |
| No source/test edits; no `.swarm/master-roadmap-log.md` edit | Pass |
| Three validators exit 0 | Run before C2 |
| Two commits + PR opened | Recorded on push |
