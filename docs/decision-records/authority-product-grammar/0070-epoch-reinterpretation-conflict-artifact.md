# Decision 0070: Epoch Reinterpretation Conflict Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
if a new epoch_reinterpretation
attempts to supersede
an already-superseded node:
  the chain is not rewritten

the system materializes:
  explicit epoch_reinterpretation_conflict artifact

artifact links:
  attempted superseded node
  current chain tip
  attempted new interpretation
  conflict reason
  issuer_or_system_source
  timestamp
```

## Why
- Preserves the linear-chain invariant while keeping conflicting reinterpretation intent inspectable for audit, debugging, and history.
