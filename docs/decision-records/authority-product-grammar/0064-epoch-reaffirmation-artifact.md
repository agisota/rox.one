# Decision 0064: Epoch Reaffirmation Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
additional reopen signals
while a reactivation_epoch is already open
materialize as:
  explicit epoch_reaffirmation artifact

artifact links:
  open reactivation_epoch
  signal source
  signal class
  timestamp
  interpretation:
    same_interval_reaffirmation
    invalid_duplicate_reopen
```

## Why
- Preserves the single-open invariant without losing repeated reopen signals needed for audit and debugging.
