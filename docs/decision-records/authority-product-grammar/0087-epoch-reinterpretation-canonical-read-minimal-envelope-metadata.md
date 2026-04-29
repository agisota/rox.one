# Decision 0087: Epoch Reinterpretation Canonical Read Minimal Envelope Metadata

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
canonical read envelope top-level must include:
  state_kind
  lineage_id
  read_model_version
  observed_at

this set is:
  minimal
  stable
  shared across all state variants

all non-shared data lives:
  in payload
```

## Why
- Keeps the envelope minimal while still supporting routing, lineage identity, tracing, and versioned consumers.
