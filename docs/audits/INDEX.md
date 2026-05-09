# Audit Index

Append-only log of audit runs. Most recent at the top.

| Timestamp | Probes | Surfaces | Findings | Critical | High | Medium | Low | Queue | Tickets created |
|---|---|---|---|---|---|---|---|---|---|
| 2026-05-09T_a2-first | runtime-* | renderer,webui,viewer,marketing | 0 | 0 | 0 | 0 | 0 | `audits/_a2-first/queue.json` | 0 — expected: surfaces are SPA-style (Vite+React Router), no static src/pages/*.html; real route discovery requires running app + crawl (A.4 territory) |
| 2026-05-09T09-41-31-836Z | static-* | renderer,webui,viewer,marketing | 0 | 0 | 0 | 0 | 0 | `audits/2026-05-09T09-41-31-836Z/queue.json` | 0 |
