# Decision 0056: Resolved Semantics

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_locus becomes resolved when:
  its authority question
  no longer requires
  any open decision

requirements:
  all member requests reached
  terminal disposition

  no unresolved remainder state
  remains inside this locus

  no replacement locus
  has taken over
  the same foreground authority space

invariant:
  downstream execution may still continue
  on child artifacts

  but the locus is already resolved
  because the user owes
  no further decision in this frame
```

## Why
- Binds resolution to decision closure rather than full execution completion.
