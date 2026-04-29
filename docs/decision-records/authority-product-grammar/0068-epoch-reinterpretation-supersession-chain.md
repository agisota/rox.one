# Decision 0068: Epoch Reinterpretation Supersession Chain

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
for one epoch_reaffirmation:
  reinterpretations form
  explicit supersession chain

each epoch_reinterpretation explicitly supersedes:
  either the original interpretation
  or one prior reinterpretation artifact

the current effective interpretation is:
  the latest non-superseded node
  in that chain
```

## Why
- Keeps effective meaning audit-stable and prevents it from depending on implicit timestamp or authority heuristics.
