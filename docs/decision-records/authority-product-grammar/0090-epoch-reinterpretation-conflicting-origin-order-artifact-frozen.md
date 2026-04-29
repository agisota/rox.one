# Decision 0090: Epoch Reinterpretation Conflicting Origin Order Artifact Frozen

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
conflicting_origin_ids order is:
  artifact-frozen
  deterministic

the frontier-conflict artifact records:
  origin order at detection time

canonical read returns:
  exactly that recorded order

canonical read does not use:
  storage iteration order
  per-read resorting
  implementation-defined reordering
```

## Why
- Keeps unresolved-conflict payload replayable and stable across reads without leaking incidental storage behavior.
