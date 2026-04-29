# Decision 0071: Epoch Reinterpretation Conflict Resolution Artifact

status: accepted
date: 2026-04-25
source_file: /Users/marklindgreen/Projects/rox/rox/docs/decision-records/authority-product-grammar/0071-epoch-reinterpretation-conflict-resolution-artifact.md
domain: authority-product-grammar
kind: decision

## canonical
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

## rationale
Preserves append-only history and keeps conflict resolution inspectable without hiding outcome in mutable fields or implicit inference.