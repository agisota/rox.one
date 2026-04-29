# Decision 0072: Epoch Reinterpretation Adoption Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if conflict_resolution chooses:
  accepted replacement

the resolution artifact:
  does not mutate chain state directly

the chain-change materializes as:
  explicit epoch_reinterpretation_adoption artifact

artifact links:
  conflict_resolution artifact
  previous canonical tip
  adopted interpretation payload
    or adopted reinterpretation source
  new canonical tip relation
  issuer_or_system_source
  timestamp
```

## Why
- Keeps adjudication and chain mutation separate, preserves append-only semantics, and makes lineage explicit without hidden state jumps.
