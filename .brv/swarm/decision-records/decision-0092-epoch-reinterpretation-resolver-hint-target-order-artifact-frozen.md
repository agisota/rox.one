# Decision 0092: Epoch Reinterpretation Resolver Hint Target Order Artifact Frozen

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if resolver_hint.target_origin_ids is present:
  its order is:
    artifact-frozen
    deterministic

the conflict artifact records:
  exactly that target order

canonical read returns:
  exactly that recorded order

canonical read does not use:
  storage iteration order
  per-read resorting
  unordered-set semantics
```

## Why
- Keeps resolver-target interpretation replayable and stable across consumers instead of leaking incidental implementation order.
