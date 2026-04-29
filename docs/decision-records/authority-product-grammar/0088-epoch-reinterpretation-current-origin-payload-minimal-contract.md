# Decision 0088: Epoch Reinterpretation Current Origin Payload Minimal Contract

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
current_origin payload must include:
  origin_id
  supersedes_origin_id?
  canonical_source_ref
  origin_status = canonical_frontier

the payload is:
  minimal
  self-sufficient for frontier binding
  self-sufficient for immediate provenance interpretation

the payload does not duplicate:
  broader origin snapshot
  variant-external envelope metadata
```

## Why
- Keeps the current-origin read minimal while still binding the exact canonical frontier node without requiring a secondary lookup.
