# Decision 0093: Epoch Reinterpretation Resolver Hint Target Membership Within Conflict

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if resolver_hint.target_origin_ids is present:
  every target origin id must appear
  in conflicting_origin_ids

target_origin_ids is:
  duplicate-free
  local to the unresolved frontier conflict
  never an external-origin reference set

resolver_hint does not widen:
  conflict membership
  dispute scope
```

## Why
- Keeps resolver targets scoped to the exact unresolved dispute already bound by the payload and avoids hidden external dependencies.
