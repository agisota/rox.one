# T151 - First A.3 audit run + INDEX row

## 1. Task summary

Run the first end-to-end A.3 audit on `webui` with `--probes=taste-llm --no-tickets --out=/tmp/a3-first` and append a row to `docs/audits/INDEX.md` recording timestamp, finding counts, queue path, and cost actuals. The plan explicitly allows deferral if `ANTHROPIC_API_KEY` is unset in the executor environment, in which case the row documents the deferral and the expected cost envelope.

## 2. Repo context discovered

- `docs/audits/INDEX.md` already has rows for `2026-05-09T_a4-first` (A.4 first run), `2026-05-09T_a2-first` (A.2 first run), and `2026-05-09T09-41-31-836Z` (initial smoke). The format is a markdown table with timestamp / probes / surfaces / counts / queue / notes.
- The CLI's new `needsLLM` gate means an unset `ANTHROPIC_API_KEY` is non-fatal: the probe simply returns `[]` and the run completes with no findings. Running the harness without a key would still produce an artefact, but it would be misleading (looks like "0 taste defects" rather than "skipped").
- The plan's stop conditions explicitly say "DO NOT make a real LLM API call unless `ANTHROPIC_API_KEY` is set in env (Task 3)" — so the deferred path is the correct outcome.

## 3. Files inspected

- `docs/audits/INDEX.md` — row format (header + 3 existing rows).
- `packages/audit/src/cli.ts` — CLI flow + `needsLLM` gate.
- `docs/superpowers/plans/2026-05-09-audit-harness-a3-llm-taste.md` — Task 3 step-by-step.

## 4. Tests added first

No tests. This is an execution / documentation task only.

## 5. Expected failing test output

N/A — no test suite involved.

## 6. Implementation changes

- Pre-flight: `[ -n "$ANTHROPIC_API_KEY" ] && echo SET || echo UNSET` → `UNSET`.
- No CLI run executed (deferred per plan stop conditions; no real API call made; cost: $0).
- `docs/audits/INDEX.md` (modified): appended a new top row above the A.4 row:

```
| 2026-05-09T_a3-deferred | taste-llm | — | — | — | — | — | — | — | DEFERRED — A.3 taste-llm probe shipped (T149/T150), first real audit run requires `ANTHROPIC_API_KEY` env var (not set in current shell). Expected cost on full run: ~$5–$15 first time, dramatically less on cache hits (system prompt cached via `cache_control: ephemeral`). |
```

Commits (T151, 1 commit):
- `b31ac1f` docs(audit): A.3 taste-llm probe shipped; first real run deferred (needs ANTHROPIC_API_KEY) [T151]

## 7. Validation commands run

```bash
[ -n "$ANTHROPIC_API_KEY" ] && echo SET || echo UNSET
head -10 docs/audits/INDEX.md
```

## 8. Passing test output summary

N/A. INDEX.md row added; `head -10 docs/audits/INDEX.md` shows the new row at the top of the table.

## 9. Build output summary

No build step.

## 10. Remaining risks

- **First-run cost actuals are unrecorded**: when `ANTHROPIC_API_KEY` becomes available, a follow-up T (T155 or similar) should run the full A.3 audit and amend `INDEX.md` with the actual finding counts + cost — the current row is a placeholder, not a measurement.
- **Cache lifetime is bounded (~5 min)**: the system-prompt cache hit rate depends on how the probe is called. Running `taste-llm` against many routes back-to-back gives a high cache-hit rate (one miss + many hits); running it sporadically across hours-long sessions gives a low hit rate (cache evictions). The plan's "$5–$15 first run" envelope assumes the back-to-back path; the deferral note in `INDEX.md` records this assumption explicitly.
- **No alarm on accidental real run**: if a future operator re-runs Task 3 with the env var set, the CLI happily makes the API calls. If we want a billing safeguard, a `--max-routes=N` flag or a `--max-cost-usd=N` budget gate would be a small follow-up; out of scope for T151.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
|---|---|---|
| Pre-flight env check executed | ✅ | `[ -n "$ANTHROPIC_API_KEY" ] && echo SET || echo UNSET` returned `UNSET` |
| INDEX.md row appended | ✅ | New top row `2026-05-09T_a3-deferred` |
| Row notes deferral + expected cost envelope | ✅ | Notes column references `ANTHROPIC_API_KEY` requirement and ~$5–$15 estimate |
| No real LLM API call made | ✅ | Pre-flight UNSET → deferred path executed; cost $0 |
| Commit created | ✅ | `b31ac1f` |
