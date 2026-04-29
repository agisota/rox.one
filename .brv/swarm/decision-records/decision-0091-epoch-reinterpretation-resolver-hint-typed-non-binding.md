# Decision 0091: Epoch Reinterpretation Resolver Hint Typed Non Binding

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
resolver_hint, if present, is:
  typed
  non-binding
  artifact-recorded
  never a per-read guess

resolver_hint may include:
  kind = manual_resolution | adoption_required | provenance_promotion_candidate
  target_origin_ids?
  reason?

canonical read does not use:
  free-text-only hinting
  predicted winner semantics
  implementation-time speculation
```

## Why
- Keeps resolver guidance honest-by-construction, machine-branchable, and stable across reads without turning canonical read into a speculative resolution layer.
