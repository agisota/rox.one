# Decision 0031: Background Queue Ordering

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
background queue ordering:
  user-pinned followers first
  cluster-related items next
  broader blockers before narrower blockers
  older unresolved items before newer ones
  recency only as final tiebreak
```

## Why
- Keeps the background queue aligned with blocked value and user intent.
