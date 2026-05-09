# Meta-Audit: State of the Codebase After Sub-Project A + D

**Date:** 2026-05-09
**Run against:** `feat/audit-a4-e2e-flows` branch (full A.1-A.4 harness with discovery refactor)
**Surfaces probed:** renderer, webui, viewer, marketing

## TL;DR

After all the audit-harness improvements landed (PRs #1-#11), running the full pipeline against real surfaces produces:

- **Static probes (`tsc`, `eslint`, `bundle`):** **0 findings** across all 4 surfaces.
- **Runtime probes (`axe-core` via Playwright):** **1 critical finding** (`axe:meta-viewport`), which **was already fixed** in PR #5 (sub-project D).

**The codebase is materially clean of the defects this audit can detect.**

## What this means

Running the audit harness against the post-cleanup codebase doesn't surface new work for sub-projects B/C to attack via static analysis or basic axe-core. The maintainers' recent commit cluster (composer ergonomics + Experience screens + accessibility warning closeouts visible in the last 4-6 weeks of git log) already addressed the obvious static issues before the harness existed.

This is a signal — not a problem. It means the audit harness works correctly AND the surfaces are in good shape against the kinds of defects A.1-A.4 detect.

## What the audit can NOT find (and what would surface more)

The 0-findings result on static + 1-finding-already-fixed on runtime understates real opportunities, because:

| Probe family | Status | Would find |
|---|---|---|
| `static-tsc` | shipped, 0 findings | TS errors (already none — `typecheck:all` enforces) |
| `static-eslint` | shipped, 0 findings | Lint violations (already none — `lint` enforces) |
| `static-bundle` | shipped, 0 findings | Over-budget chunks (budgets calibrated to current; gate prevents regression only) |
| `runtime-axe` | shipped, found+fixed | Per-route WCAG 2.2 AA — but only on routes the crawler reaches |
| `runtime-states` | shipped, untested vs real surfaces | Missing empty/loading/error UI states — heuristic, may surface noise |
| `taste-llm` | shipped, **deferred without `ANTHROPIC_API_KEY`** | Visual taste issues (alignment, contrast, hierarchy) — **the biggest untapped probe** |
| `e2e-flows` | **deferred to A.5** | Integration/state-machine bugs across user flows |
| Electron renderer | **deferred to A.5** | Anything in the renderer surface (composer, dialogs, etc.) |

## Concrete recommendations

To unlock more findings, in priority order:

1. **Set `ANTHROPIC_API_KEY` and run `taste-llm` against webui+viewer+marketing.** With the cost gate (PR #9, default `--max-llm-calls=100`), max spend is bounded. Likely surfaces 5-30 visual issues at $5-15 first run.

2. **Land A.5 (Electron renderer probing)** from your parallel session's plan (`docs/superpowers/plans/2026-05-09-audit-harness-a5-...md` exists). The renderer surface is where the composer + Experience screens live — currently un-probed.

3. **Run `runtime-states` heuristic against real surfaces** with confidence-0.5 weight (so findings are downweighted in the queue). Will surface false positives but also real missing states.

4. **Author `e2e-flows` probes** for the 5 documented user flows (deferred from original A.4 spec to A.5). These find interaction bugs static analysis can't.

## Implication for sub-project B (composer polish)

Without renderer audit findings as input, B's scope is design-driven not evidence-driven. Recent commit cluster already polished composer extensively. To run B with evidence, gate on:
- A.5 renderer probing complete → renderer-scoped queue available
- `taste-llm` run complete → visual issues queue available

If the user wants B to ship without that evidence, pick scope by gut judgment (the user knows what's bothering them about the composer). That's valid — but document it as "designer-call" rather than "evidence-driven."

## Implication for sub-project C (Experience screens)

Same as B — no renderer findings yet. C is the largest scope; running with no evidence = high risk of misdirected work. Gate on A.5 + taste-llm.

## Implication for sub-projects F.1, F.2 (bundle shrinkage)

F.2 already shipped (PR #11, -480KB). F.1 (shiki) is documented as needing `'shiki/core'` API migration (~1 week). Gate F.1 on a brainstorm covering: singleton pattern, eager-load language list, TipTap integration check.

## Run metrics

- Static run: 18,451ms across 4 surfaces × 3 probes (12 probe-runs)
- Runtime run: 6,546ms (webui only, 1 probe, includes Vite dev-server spawn + Playwright launch + axe-core analysis + 1-page crawl)
- Both well under the spec's "≤10 min full audit" target

## Honest summary

The audit harness is working as designed. The surfaces are in better shape than my pre-audit pessimism assumed. The big unlocked work is:
1. Setting `ANTHROPIC_API_KEY` and running taste-llm (highest-impact next probe)
2. Landing A.5 (renderer probing) — your parallel session has the plan
3. Brainstorming F.1 (shiki shrinkage) when ready to do the API migration

This meta-audit should be re-run after those three land to see the next wave of findings.
