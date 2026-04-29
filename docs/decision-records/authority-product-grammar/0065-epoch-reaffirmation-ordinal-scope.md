# Decision 0065: Epoch Reaffirmation Ordinal Scope

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
epoch_reaffirmation.ordinal is:
  per reactivation_epoch sequence

ordinal increments only:
  within one reactivation_epoch

each new epoch:
  starts its own reaffirmation count
```

## Why
- Keeps reaffirmation numbering local to one reopened span and avoids leaking sequence semantics across epochs, loci, or sources.
