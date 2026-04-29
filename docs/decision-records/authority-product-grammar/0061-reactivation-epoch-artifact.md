# Decision 0061: Reactivation Epoch Artifact

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
each reopened live-span of a decision_locus materializes as:
  explicit reactivation_epoch artifact

the artifact is the canonical inspectable span unit:
  for one reopened interval
  of the same locus

artifact links:
  locus
  opening locus_reactivation
  closing reactivation_terminalization
  ordinal
  started_at
  ended_at_or_open
```

## Why
- Makes repeated reopen cycles countable, comparable, and auditable without reconstructing spans from event inference.
