# Decision 0097: Epoch Reinterpretation Resolver Hint Absent Target Means Whole Conflict Scope

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if resolver_hint is present
and target_origin_ids is absent:
  hint scope is
    the full unresolved conflict
    as bound by conflicting_origin_ids

target_origin_ids omission does not mean:
  unknown subset
  implicit filtering
  deferred target discovery

if a hint applies only to a subset:
  record target_origin_ids explicitly
```

## Why
- Aligns optional target omission with full-conflict scope and prevents hidden partial-application semantics inside a supposedly deterministic hint payload.
