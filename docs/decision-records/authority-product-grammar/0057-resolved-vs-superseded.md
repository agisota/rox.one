# Decision 0057: Resolved Vs Superseded

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_locus.resolved:
  the authority question
  is complete
  within its own frame

  no further foreground decision
  is required there

decision_locus.superseded:
  this locus lost
  canonical foreground role

  because another locus became
  the replacement-frame
  for the same authority space

invariant:
  a superseded locus may stop being primary
  without the original question
  being completed inside that old frame
```

## Why
- Separates completion semantics from replacement semantics.
