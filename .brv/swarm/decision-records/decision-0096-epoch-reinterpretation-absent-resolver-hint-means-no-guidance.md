# Decision 0096: Epoch Reinterpretation Absent Resolver Hint Means No Guidance

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if resolver_hint is absent:
  canonical read expresses
  no structured resolver guidance

consumers must not infer:
  default hint kind
  default target_origin_ids
  predicted winner
  implicit manual_resolution
```

## Why
- Keeps the optional hint field honest-by-construction and prevents absence from becoming a second hidden signaling channel.
