# Decision 0095: Epoch Reinterpretation Resolver Hint Kind V1 Closed Vocabulary

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
in read_model_version v1:
  resolver_hint.kind uses
  a closed canonical vocabulary

allowed values are exactly:
  manual_resolution
  adoption_required
  provenance_promotion_candidate

v1 canonical read does not emit:
  unknown hint kinds
  implementation-local kind extensions
```

## Why
- Keeps typed resolver behavior schema-stable for versioned consumers and prevents silent kind drift inside the same read model version.
