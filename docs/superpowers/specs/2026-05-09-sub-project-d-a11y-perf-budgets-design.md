# Sub-Project D — A11y + Perf Budgets — Design Spec

Date: 2026-05-09
Sub-project: **D** (of A → B → D → C sequence; A complete, B/D run in parallel)
Status: Drafted from user engineering rules; pending user approval.
Driving requirements: `CLAUDE.md` user engineering rules § code_quality (`≤200KB JS bundle, LCP ≤2.5s, INP ≤200ms, WCAG 2.2 AA`).

## 1. Overview

Sub-project D codifies the user's engineering rules as **automated CI gates** using the audit harness shipped in sub-project A. It does NOT undertake new audit-harness infrastructure work — it consumes the harness.

Three concrete deliverables:
1. `budget.json` files for each user-facing surface (renderer, webui, viewer, marketing) with realistic byte budgets.
2. A CI-runnable a11y gate using `runtime-axe` against a fixture surface (avoids needing live dev servers in CI).
3. Fix the **1 real finding** A.4's first run already surfaced: `axe:meta-viewport user-scalable=no` on webui.

## 2. Scope

### 2.1 In scope
- Add `budget.json` per surface — `apps/{electron,webui,viewer,marketing}/budget.json`. Initial budgets calibrated against current bundle sizes (no immediate violations; gate prevents regressions).
- Add a CI smoke gate: extend `scripts/audit-smoke.sh` to also run `static-bundle` and `runtime-axe` against the SPA fixture.
- Fix the meta-viewport violation on webui's `index.html`.
- One ticket per deliverable, AGENTS.md format throughout.

### 2.2 Out of scope
- Lighthouse perf gate (needs Lighthouse CI infrastructure beyond `bun run audit`).
- LCP/INP runtime instrumentation (needs real-user metrics or synthetic Web Vitals harness; defer to sub-project E or future spec).
- Bundle splitting / code-split optimizations (refactor work, not a gate).
- A11y fixes beyond the meta-viewport finding (will surface naturally as audit runs accumulate).

## 3. Architecture

The audit harness already supports everything D needs. D's work is configuration + one bug fix + CI wiring.

### 3.1 Per-surface budget calibration

Run `bun run build` for each surface, measure current dist sizes, set `budget.json` = current size + 10% headroom (room to grow without immediate regression alerts).

### 3.2 CI gate

`scripts/audit-smoke.sh` currently runs `static-tsc` against renderer. Extend to also run:
- `static-bundle` against any surface where `budget.json` exists (validates the gate works).
- `runtime-axe` against the SPA fixture (`packages/audit/tests/fixtures/spa-fixture/`) — hermetic, fast, no live server needed.

Both should fail the script if findings exceed defined thresholds.

### 3.3 Meta-viewport fix

`apps/webui/index.html` (or wherever the offending meta tag lives — locate via `grep`). Remove `user-scalable=no` from the viewport meta tag content. Add a regression test asserting the tag does NOT contain that string.

## 4. Tickets

| Ticket | Scope | Effort |
|---|---|---|
| T153 | budget.json files for 4 surfaces, calibrated | ~1d |
| T154 | scripts/audit-smoke.sh extension (static-bundle + runtime-axe gates) | ~0.5d |
| T155 | Fix meta-viewport user-scalable on webui + regression test | ~0.5d |

Total: ~2 days. Smaller than any A.x phase. Self-contained.

## 5. Definition of Done

- [ ] `apps/{electron,webui,viewer,marketing}/budget.json` exist, each with realistic budgets matching current dist sizes + headroom.
- [ ] `validate:audit` runs `static-bundle` against at least one surface with budget.json — passes initially, fails when bundle grows past budget (verified by introducing a test bloat and asserting failure).
- [ ] `validate:audit` runs `runtime-axe` against `spa-fixture/` — passes initially (fixture has no violations) — note: spa-fixture currently DOES have axe violations (no title, etc.) per A.2's `axe-broken/` fixture; clarify spa-fixture vs axe-broken.
- [ ] webui's meta-viewport no longer contains `user-scalable=no`. Regression test in place.
- [ ] All tests in `packages/audit/` still pass.
- [ ] T153-T155 tickets + worklogs in `docs/{tickets,worklog}/` per AGENTS.md.
- [ ] Architect verification (Opus, separate context) before merge.
