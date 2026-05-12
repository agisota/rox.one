# audit

Audit harness for the ROX ONE Agent Workbench Suite. See spec `docs/superpowers/specs/2026-05-09-audit-harness-design.md`.

Phase A.1 (this phase): static probes only — `static-tsc`, `static-eslint`, `static-bundle`.
Phase A.2: runtime + axe-core (later).
Phase A.3: LLM taste pass (later).
Phase A.4: E2E user-flow probes (later).

## Usage (after A.1 ships)

```
bun run audit run <surfaces> [--probes=<csv>]
bun run audit run renderer --probes=static-tsc
bun run audit run renderer,webui,viewer,marketing --probes=static-*
```

Output:
- `audits/<date>/queue.json` — canonical, schema-versioned (gitignored)
- `audits/<date>/queue.md` — human-readable sidecar (gitignored)
- `docs/tickets/T<N>-*.md` — top-50 ticket stubs (committed)
- `docs/audits/INDEX.md` — append-only audit log (committed)
