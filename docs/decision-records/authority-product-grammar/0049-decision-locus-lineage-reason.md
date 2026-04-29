# Decision 0049: Decision Locus Lineage Reason

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
every decision_locus lineage link stores:
  reason
  source event
  timestamp

reason examples:
  scope_branch
  conflict_isolation
  replacement_frame
  user_repin
```

## Why
- Preserves why the lineage edge exists, not just that it exists.
