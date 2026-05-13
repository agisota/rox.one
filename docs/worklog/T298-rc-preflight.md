# T298-rc-preflight - RC validation pre-flight checklist + 72h soak protocol (M.20)

Status: DONE
Phase: M.20 (RC validation gate)
Ticket: docs/tickets/T298-rc-preflight.md
Spine: docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md
Master roadmap: docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md Phase 20

## 1. Task summary

Author the canonical RC pre-flight checklist and 72-hour soak protocol the
release operator consults before tagging `v1.0.0-rc.1` and during the soak
window that gates promotion to `v1.0.0`. Doc-only change; no source or test
files touched.

## 2. Repo context discovered

- `T298` reserved in the rebrand goal for the R.11 git-history-rewrite closeout. `T298a-rebrand-allowlist-expansion.md` exists for R.9.5; the agent-contract regex (`/^T\d{3}-.+\.md$/`) excludes `T298a-*` (letter between digits and hyphen).
- `package.json` carries 16 `validate:*` scripts; the checklist quotes the relevant ones verbatim and groups them by ownership.
- Pillar 4 composer surfaces named in the spec (composer-history, composer-emphasis, line-numbers, paste-image, voice-slot) seeded the §4 manual-walk table.
- Master-roadmap Phase 20 stopping condition gives the tag-time evidence requirements; M.21 owns the promotion-to-`v1.0.0` step.

## 3. Files inspected

`package.json`, `docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md`, `docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md`, `docs/superpowers/specs/2026-05-13-composer-pillar-4-design.md`, `docs/tickets/TEMPLATE.md`, `docs/worklog/README.md`, `scripts/validate-agent-contract.ts`.

## 4. Tests added first / 5. Expected failing test output

Not applicable — doc-only change set, no test harness modification.

## 6. Implementation changes

- `docs/release/v1-rc-preflight-checklist.md` — new, 105 LOC.
- `docs/release/v1-rc-72h-soak-protocol.md` — new, 97 LOC.
- `docs/tickets/T298-rc-preflight.md` — new ticket, this worklog's sibling.
- `docs/worklog/T298-rc-preflight.md` — this file.

## 7. Validation commands run

```
bun run validate:rebrand            # exit 0
bun run validate:agent-contract     # exit 1 (pre-existing T223 Status line)
bun run validate:roadmap            # exit 1 (pre-existing M.1.3b heading)
```

The two `exit 1`s are pre-existing on `origin/main` and unrelated to this
branch. `validate:rebrand` is the relevant gate for a doc-only release-eng
change and it stays green.

## 8. Passing test output summary

`bun run validate:rebrand`:
`rebrand validation passed: no forbidden tokens outside the allowlist`.

## 9. Build output summary

Not applicable — no source change to build.

## 10. Remaining risks

- Checklist hard-codes `validate:*` script names; a future rename needs a checklist update (T297's permanent gate catches outright deletions only).
- Soak protocol assumes a single on-call operator; rotation requires per-shift cadence split in the evidence doc.
- `T298b-rc-soak-failure-<short-mode>` is referenced but not created here — soak-time follow-up, created only if a soak-failure fires.

## 11. Acceptance criteria matrix

| Criterion | Evidence |
| --- | --- |
| pre-flight checklist exists, ≤200 LOC | `docs/release/v1-rc-preflight-checklist.md` — 105 LOC |
| 72h soak protocol exists, ≤150 LOC | `docs/release/v1-rc-72h-soak-protocol.md` — 97 LOC |
| ticket `Status: DONE` | `docs/tickets/T298-rc-preflight.md` line 3 |
| matching worklog | this file |
| `validate:rebrand` green | §7, §8 |
| no source/test files changed | `git diff --name-only main..HEAD` shows docs only |
