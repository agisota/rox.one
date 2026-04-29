# Decision 0084: Epoch Reinterpretation Frontier Conflict Read Object

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
while frontier-conflict artifact is:
  unresolved

canonical read returns:
  explicit conflict read object
  not forged current origin

the read object includes:
  lineage id
  frontier-conflict artifact id
  conflicting frontier origin ids
  status = unresolved_conflict
  last_detected_at
  optional resolver_hint
```

## Why
- Keeps the read surface honest-by-construction and preserves deterministic downstream handling without inventing singular canonical state.
