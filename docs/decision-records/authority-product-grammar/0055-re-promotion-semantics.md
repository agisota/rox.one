# Decision 0055: Re Promotion Semantics

- Status: accepted
- Date: 2026-04-25

## Canonical
```text
decision_locus returns to active-primary
when it again owns
the canonical foreground gate surface

common triggers:
  current primary resolved
  current primary superseded
  current primary foreground binding moved away
  user explicitly repinned focus

invariant:
  promotion is a material foreground-state transition
  not a silent UI reorder
```

## Why
- Restores primary status through authority semantics rather than incidental ordering.
