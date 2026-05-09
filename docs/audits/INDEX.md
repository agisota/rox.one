# Audit Index

Append-only log of audit runs. Most recent at the top.

| Timestamp | Probes | Surfaces | Findings | Critical | High | Medium | Low | Queue | Tickets created |
|---|---|---|---|---|---|---|---|---|---|
| 2026-05-09T_a3-deferred | taste-llm | — | — | — | — | — | — | — | DEFERRED — A.3 taste-llm probe shipped (T149/T150), first real audit run requires `ANTHROPIC_API_KEY` env var (not set in current shell). Expected cost on full run: ~$5–$15 first time, dramatically less on cache hits (system prompt cached via `cache_control: ephemeral`). |
| 2026-05-09T_a4-first | runtime-axe | webui,viewer,marketing | 1 | 1 | 0 | 0 | 0 | `audits/2026-05-09T_a4-first/queue.json` | 0 — first A.4 run with route crawler against live Vite servers; webui critical = `axe:meta-viewport` (user-scalable=no on `<meta viewport>`); viewer + marketing axe-clean on default route (only entry point crawled — viewer at `/s/` has no anchors, marketing has external-only links). Run took 5.7s end-to-end. |
| 2026-05-09T_a2-first | runtime-* | renderer,webui,viewer,marketing | 0 | 0 | 0 | 0 | 0 | `audits/_a2-first/queue.json` | 0 — expected: surfaces are SPA-style (Vite+React Router), no static src/pages/*.html; real route discovery requires running app + crawl (A.4 territory) |
| 2026-05-09T09-41-31-836Z | static-* | renderer,webui,viewer,marketing | 0 | 0 | 0 | 0 | 0 | `audits/2026-05-09T09-41-31-836Z/queue.json` | 0 |
