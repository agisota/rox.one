# Decision 0063: Reactivation Epoch Single Open Invariant

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
for one stable decision_locus:
  at most one open reactivation_epoch may exist

while an epoch is open:
  additional reopen signals
  do not create a new epoch

they are interpreted as either:
  belonging to the same live interval
  or invalid duplicate reopen attempts
```

## Why
- Preserves clean ordinal semantics and prevents overlapping live-span ambiguity on a single locus.
