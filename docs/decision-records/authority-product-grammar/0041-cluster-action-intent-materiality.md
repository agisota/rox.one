# Decision 0041: Cluster Action Intent Materiality

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
material cluster_action_intent events:
  created
  committed
  blocked
  cancelled
  superseded

per-member expansions may remain
inspect-level
unless they change
foreground state
```

## Why
- Preserves one shared material history while allowing low-level fan-out details to stay drilldown-only.
