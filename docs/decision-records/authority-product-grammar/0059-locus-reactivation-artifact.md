# Decision 0059: Locus Reactivation Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_locus reopen materializes as:
  explicit locus_reactivation artifact

the artifact is the canonical inspectable reason:
  why a previously resolved locus
  became live again

artifact links:
  reactivated locus
  triggering invalidation_or_reopened_child
  issuer_or_system_source
  timestamp
  resulting active state

state flips and timeline events:
  may coexist
  but are auxiliary_or_derived
  not the canonical reason record
```

## Why
- Makes reopen observable, auditable, and debuggable without relying on hidden state transitions.
