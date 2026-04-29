# Decision 0071: Epoch Reinterpretation Conflict Resolution Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
epoch_reinterpretation_conflict
remains immutable

resolution materializes as:
  explicit epoch_reinterpretation_conflict_resolution artifact

artifact links:
  conflict artifact
  resolution outcome
  chosen canonical tip
    or accepted replacement
  resolver_or_system_source
  reason_or_evidence
  timestamp
```

## Why
- Preserves append-only history and keeps conflict resolution inspectable without hiding outcome in mutable fields or implicit inference.
