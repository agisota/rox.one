# Decision 0098: Epoch Reinterpretation Resolver Hint Target Order Non Priority

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if resolver_hint.target_origin_ids is present:
  recorded order is:
    stable enumeration only
    not priority ranking
    not predicted resolution order

consumers must not infer from position:
  preferred winner
  resolver confidence
  required processing sequence

if priority semantics are ever needed:
  they require
    new explicit field
    or newer read_model_version
```

## Why
- Preserves deterministic replay and artifact stability without smuggling branch semantics into positional encoding.
