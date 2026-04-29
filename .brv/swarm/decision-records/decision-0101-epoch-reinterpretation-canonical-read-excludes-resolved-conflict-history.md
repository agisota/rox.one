# Decision 0101: Epoch Reinterpretation Canonical Read Excludes Resolved Conflict History

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
after conflict resolution:
  canonical read reflects present canonical state only

canonical read does not inline:
  resolved conflict snapshot
  losing origin set
  resolution rationale
  conflict_resolution artifact body

historical resolution inspection uses:
  frontier-conflict artifact
  conflict_resolution artifact
  adoption artifact when present
```

## Why
- Separates present-state readback from audit/history surfaces and prevents resolved-conflict history from bloating the canonical read contract.
