# T151 - First A.3 audit run + INDEX row

Status: deferred — code shipped, real run blocked on `ANTHROPIC_API_KEY`

## Context

Phase A.3 of the audit harness. After the `taste-llm` probe (T150) and the LLM runner (T149) ship, run a small first audit against `webui` with `--probes=taste-llm` to validate the end-to-end flow and capture findings + cost actuals in `docs/audits/INDEX.md`.

## Summary

`ANTHROPIC_API_KEY` is not set in the executor environment for this branch. Per the plan's stop conditions, the real LLM call is deferred — no API call is made, no findings are produced. Instead, the harness changes from T149/T150 are documented in INDEX.md as a `2026-05-09T_a3-deferred` row noting the deferral and the expected cost envelope (~$5–$15 first run, dramatically less on cache hits via `cache_control: ephemeral` on the system prompt).

## Acceptance Criteria

- [x] Pre-flight check: `[ -n "$ANTHROPIC_API_KEY" ] && echo SET || echo UNSET` → `UNSET`.
- [x] `docs/audits/INDEX.md` appended with row `2026-05-09T_a3-deferred` documenting deferral + expected cost envelope.
- [x] No real LLM API call made (cost: $0).
- [x] Worklog `docs/worklog/T151-first-a3-audit-run.md` complete.
- [x] Commit created.

## Validation Commands

```bash
[ -n "$ANTHROPIC_API_KEY" ] && echo SET || echo UNSET
head -10 docs/audits/INDEX.md
```

## Worklog

`docs/worklog/T151-first-a3-audit-run.md`
