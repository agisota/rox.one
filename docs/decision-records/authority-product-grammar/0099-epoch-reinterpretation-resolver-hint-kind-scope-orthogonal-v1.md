# Decision 0099: Epoch Reinterpretation Resolver Hint Kind Scope Orthogonal V1

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
in read_model_version v1:
  resolver_hint.kind defines:
    guidance class

  target_origin_ids presence defines:
    scope shape

there is no v1 kind-specific rule that:
  target_origin_ids must be present
  target_origin_ids must be absent

therefore any v1 hint kind may be:
  whole-conflict scoped
  subset-scoped

whole-conflict scope is expressed by:
  omitted target_origin_ids

subset scope is expressed by:
  explicit target_origin_ids
```

## Why
- Keeps the v1 hint contract orthogonal and compact, instead of hiding a per-kind field matrix behind implementation conventions.
