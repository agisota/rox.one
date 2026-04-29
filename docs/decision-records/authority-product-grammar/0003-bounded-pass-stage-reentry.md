# Decision 0003: Bounded Pass Stage Reentry

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
stage_reentry:
  use explicit bounded_pass
```

## Why
- Makes rework explicit instead of silently looping stages.
- Preserves traceability for controlled iteration.
