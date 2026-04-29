# Decision 0060: Reactivation Terminalization Record

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
locus_reactivation closes via:
  explicit reactivation_terminalization record

the record is the canonical inspectable reason:
  why the reactivation interval
  is no longer live

record links:
  reactivation artifact
  closing cause
  resolved_by artifact_or_state
  timestamp

parent state changes and child settlement:
  may coexist
  but are auxiliary_or_derived
  not the canonical close record
```

## Why
- Keeps reopen lifecycle symmetric, auditable, and resistant to hidden derived-close semantics.
