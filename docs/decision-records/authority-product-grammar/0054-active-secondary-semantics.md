# Decision 0054: Active Secondary Semantics

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_locus.state = active-secondary when:
  locus remains unresolved
  and still relevant

but:
  it no longer owns
  the canonical foreground gate surface

because:
  another locus is currently primary
  for the overlapping authority problem-space

invariant:
  secondary locus remains
  inspectable
  recoverable
  and eligible to return to active-primary
```

## Why
- Defines secondary as live authority that temporarily lost foreground ownership.
