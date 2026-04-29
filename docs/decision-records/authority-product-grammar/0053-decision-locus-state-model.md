# Decision 0053: Decision Locus State Model

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_locus states:
  active-primary
  active-secondary
  resolved
  superseded

invariant:
  only one locus may be
  active-primary
  for the same authority space
```

## Why
- Establishes one compact lifecycle before secondary semantics are refined.
