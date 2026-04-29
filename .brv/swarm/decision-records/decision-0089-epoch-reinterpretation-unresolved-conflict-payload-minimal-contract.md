# Decision 0089: Epoch Reinterpretation Unresolved Conflict Payload Minimal Contract

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
unresolved_conflict payload must include:
  frontier_conflict_artifact_id
  conflicting_origin_ids
  last_detected_at
  resolver_hint?

the payload is:
  minimal
  self-sufficient for deterministic conflict handling
  self-sufficient for exact dispute binding

the payload does not duplicate:
  envelope discriminator
  broader conflict snapshot
  variant-external metadata
```

## Why
- Keeps the unresolved-conflict read compact while preserving the fields needed to bind the exact canonical dispute and support deterministic resolver behavior.